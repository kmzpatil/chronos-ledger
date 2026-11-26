'use client';

import { create } from 'zustand';
import {
  ActiveFocusSession,
  BlockedDomainConfig,
  PresetId,
  StudyCircle,
  UnlockIntention,
  UserProfile,
  UserSettings,
} from '../types/chronos';
import { LocalUserStoreDoc } from '../lib/crypto/ledger';
import { AcousticAlertEvent, acousticEngine } from '../lib/audio/acoustic-engine';

const getAuthApi = () => import('../lib/firebase/auth');
const getFsApi = () => import('../lib/firebase/firestore');

export type BootStage = 'AUTH' | 'LEDGER' | 'SHIELDS' | 'READY';

interface ChronosStoreState {
  bootStage: BootStage;
  bootProgress: number;
  ledgerValid: boolean;
  lastSyncAt: number;
  profile: UserProfile | null;
  userDoc: LocalUserStoreDoc | null;
  circles: StudyCircle[];

  // UI Chrome State
  isSettingsOpen: boolean;
  isAuthModalOpen: boolean;
  unlockTarget: BlockedDomainConfig | null;
  focusHeaderRetracted: boolean;
  acousticAlerts: AcousticAlertEvent[];

  setSettingsOpen: (v: boolean) => void;
  setAuthModalOpen: (v: boolean) => void;
  setUnlockTarget: (d: BlockedDomainConfig | null) => void;
  setFocusHeaderRetracted: (v: boolean) => void;
  dismissAcousticAlert: (id: string) => void;

  // Lifecycle
  initRuntime: () => () => void;

  // Auth Actions
  loginGoogle: () => Promise<void>;
  loginEmail: (email: string, password: string) => Promise<void>;
  signupEmail: (email: string, password: string, name: string) => Promise<void>;
  loginGuest: () => Promise<void>;
  upgradeGoogle: () => Promise<void>;
  upgradeEmail: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;

  // Economy & Shields
  buyPass: (
    domain: BlockedDomainConfig,
    minutes: number,
    intention: UnlockIntention
  ) => Promise<{ ok: boolean; error?: string }>;
  lockEarlyAndRefund: () => Promise<{ refundedCR: number; domainLabel: string }>;
  addBlockedDomain: (
    label: string,
    domain: string,
    costPerMin: number
  ) => Promise<{ ok: boolean; message: string }>;
  removeBlockedDomain: (domainId: string) => Promise<{ cooldownScheduled: boolean; message: string }>;

  // Focus Chamber FSM Actions
  mintSessionCredits: (
    minutes: number,
    taskLabel: string,
    strictStake: boolean,
    debriefSummary?: string
  ) => Promise<{ mintedCR: number; txHash: string }>;
  applyAbandonPenalty: (taskLabel: string) => Promise<number>;
  setFocusSession: (session: ActiveFocusSession | null) => Promise<void>;

  // Settings & Export
  patchSettings: (patch: {
    preset?: PresetId;
    earnRatePerMin?: number;
    blockedDomains?: BlockedDomainConfig[];
    strictLocalAI?: boolean;
    soundEnabled?: boolean;
    soundVolume?: number;
    ringtoneStyle?: UserSettings['ringtoneStyle'];
  }) => Promise<{ cooldownScheduled: boolean; message: string }>;
  exportLedgerJson: () => void;

  // Study Circles
  refreshCircles: () => Promise<void>;
  createCircle: (name: string) => Promise<StudyCircle | null>;
  joinCircle: (code: string) => Promise<{ ok: boolean; error?: string }>;
  pulseFocus: (isFocusing: boolean, taskTag: string | null) => Promise<void>;
}

let bootStarted = false;
let warnedPassStartedAt: number | null = null;

export const useChronosStore = create<ChronosStoreState>((set, get) => ({
  bootStage: 'AUTH',
  bootProgress: 12,
  ledgerValid: true,
  lastSyncAt: Date.now(),
  profile: null,
  userDoc: null,
  circles: [],

  isSettingsOpen: false,
  isAuthModalOpen: false,
  unlockTarget: null,
  focusHeaderRetracted: false,
  acousticAlerts: [],

  setSettingsOpen: (v) => set({ isSettingsOpen: v }),
  setAuthModalOpen: (v) => set({ isAuthModalOpen: v }),
  setUnlockTarget: (d) => set({ unlockTarget: d }),
  setFocusHeaderRetracted: (v) => set({ focusHeaderRetracted: v }),
  dismissAcousticAlert: (id) =>
    set((s) => ({ acousticAlerts: s.acousticAlerts.filter((a) => a.id !== id) })),

  initRuntime: () => {
    if (bootStarted || typeof window === 'undefined') return () => {};
    bootStarted = true;

    let disposed = false;
    let unsubAuth: (() => void) | null = null;
    let unsubFirestore: (() => void) | null = null;

    const unsubAcoustic = acousticEngine.onAlert((evt) => {
      set((s) => ({ acousticAlerts: [evt, ...s.acousticAlerts].slice(0, 3) }));
      setTimeout(() => {
        get().dismissAcousticAlert(evt.id);
      }, 9500);
    });

    Promise.all([getAuthApi(), getFsApi()]).then(([authApi, fsApi]) => {
      if (disposed) return;

      unsubAuth = authApi.subscribeAuthState(async (nextProfile) => {
        if (disposed) return;
        if (!nextProfile) {
          set({
            profile: null,
            userDoc: null,
            circles: [],
            bootStage: 'READY',
            bootProgress: 100,
          });
          return;
        }

        set({ profile: nextProfile, bootStage: 'LEDGER', bootProgress: 48 });

        const { doc: hydrated, chainValid } = await fsApi.hydrateUserStore(nextProfile);
        if (disposed) return;

        acousticEngine.configure({
          enabled: hydrated.settings.soundEnabled,
          volume: hydrated.settings.soundVolume,
          style: hydrated.settings.ringtoneStyle,
        });

        set({
          ledgerValid: chainValid,
          bootStage: 'SHIELDS',
          bootProgress: 82,
          userDoc: hydrated,
          lastSyncAt: Date.now(),
        });

        fsApi.broadcastToExtension(hydrated.activePass, hydrated.settings.blockedDomains);

        const userCircles = await fsApi.fetchUserCircles(nextProfile);
        if (disposed) return;
        set({ circles: userCircles });

        setTimeout(() => {
          if (!disposed) set({ bootProgress: 100, bootStage: 'READY' });
        }, 160);

        if (unsubFirestore) unsubFirestore();
        unsubFirestore = fsApi.subscribeUserDoc(nextProfile.uid, (updated) => {
          acousticEngine.configure({
            enabled: updated.settings.soundEnabled,
            volume: updated.settings.soundVolume,
            style: updated.settings.ringtoneStyle,
          });
          set({ userDoc: updated, lastSyncAt: Date.now() });
        });
      });
    });

    // Global 1-second timer monitoring active pass for 2m warning ringtone & pass expiry chime
    const passTimer = setInterval(async () => {
      const doc = get().userDoc;
      if (!doc?.activePass) return;
      const remainingMs = doc.activePass.expiresAt - Date.now();
      if (remainingMs <= 0) {
        const label = doc.activePass.label;
        const { expireActivePassSilently } = await getFsApi();
        const nextDoc = await expireActivePassSilently(doc);
        set({ userDoc: nextDoc, lastSyncAt: Date.now() });
        acousticEngine.playPassExpiredTone(label);
        return;
      }
      if (
        remainingMs <= 2 * 60 * 1000 &&
        remainingMs > 1000 &&
        warnedPassStartedAt !== doc.activePass.startedAt
      ) {
        warnedPassStartedAt = doc.activePass.startedAt;
        acousticEngine.playPassWarningRingtone({ domainLabel: doc.activePass.label });
      }
    }, 1000);

    return () => {
      disposed = true;
      bootStarted = false;
      clearInterval(passTimer);
      unsubAcoustic();
      if (unsubAuth) unsubAuth();
      if (unsubFirestore) unsubFirestore();
    };
  },

  loginGoogle: async () => {
    const { signInWithGoogle } = await getAuthApi();
    await signInWithGoogle();
    set({ isAuthModalOpen: false });
  },

  loginEmail: async (email, password) => {
    const { signInWithEmail } = await getAuthApi();
    await signInWithEmail(email, password);
    set({ isAuthModalOpen: false });
  },

  signupEmail: async (email, password, name) => {
    const { registerWithEmail } = await getAuthApi();
    await registerWithEmail(email, password, name);
    set({ isAuthModalOpen: false });
  },

  loginGuest: async () => {
    const { continueAsGuest } = await getAuthApi();
    await continueAsGuest();
    set({ isAuthModalOpen: false });
  },

  upgradeGoogle: async () => {
    const [{ upgradeGuestWithGoogle }, { hydrateUserStore }] = await Promise.all([
      getAuthApi(),
      getFsApi(),
    ]);
    const updated = await upgradeGuestWithGoogle();
    set({ profile: updated });
    const { doc: next } = await hydrateUserStore(updated);
    set({ userDoc: next, lastSyncAt: Date.now() });
  },

  upgradeEmail: async (email, password, name) => {
    const [{ upgradeGuestWithEmail }, { hydrateUserStore }] = await Promise.all([
      getAuthApi(),
      getFsApi(),
    ]);
    const updated = await upgradeGuestWithEmail(email, password, name);
    set({ profile: updated });
    const { doc: next } = await hydrateUserStore(updated);
    set({ userDoc: next, lastSyncAt: Date.now() });
  },

  logout: async () => {
    const { signOutChronos } = await getAuthApi();
    await signOutChronos();
    acousticEngine.stopBrownNoise();
    set({ profile: null, userDoc: null, circles: [], isSettingsOpen: false });
  },

  buyPass: async (domain, minutes, intention) => {
    const current = get().userDoc;
    if (!current) return { ok: false, error: 'Sign in required' };
    const { unlockDomainPass } = await getFsApi();
    const res = await unlockDomainPass(current, domain, minutes, intention);
    if (res.ok && res.nextDoc) {
      set({ userDoc: res.nextDoc, lastSyncAt: Date.now() });
      acousticEngine.playVaultEngage(1);
    }
    return { ok: res.ok, error: res.error };
  },

  lockEarlyAndRefund: async () => {
    const current = get().userDoc;
    if (!current) return { refundedCR: 0, domainLabel: 'Shield' };
    const { lockPassEarlyAndRefund } = await getFsApi();
    const { nextDoc, refundedCR, domainLabel } = await lockPassEarlyAndRefund(current);
    set({ userDoc: nextDoc, lastSyncAt: Date.now() });
    acousticEngine.playPassExpiredTone(domainLabel);
    return { refundedCR, domainLabel };
  },

  addBlockedDomain: async (label, domain, costPerMin) => {
    const current = get().userDoc;
    if (!current) return { ok: false, message: 'Sign in required' };
    const cleanDomain = domain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '');
    if (!cleanDomain || !label.trim()) {
      return { ok: false, message: 'Domain and label are required.' };
    }
    const newItem: BlockedDomainConfig = {
      id: `dom_${Date.now()}`,
      label: label.trim(),
      domain: cleanDomain,
      costPerMin: Math.max(1, Math.min(10, Math.round(costPerMin))),
      category: 'custom',
    };
    const nextDomains = [...current.settings.blockedDomains, newItem];
    const { updateSettingsWithCooldown } = await getFsApi();
    const res = await updateSettingsWithCooldown(current, { blockedDomains: nextDomains });
    set({ userDoc: res.nextDoc, lastSyncAt: Date.now() });
    acousticEngine.playTick();
    return { ok: true, message: `Added ${newItem.domain} shield.` };
  },

  removeBlockedDomain: async (domainId) => {
    const current = get().userDoc;
    if (!current) return { cooldownScheduled: false, message: 'No active session' };
    const nextDomains = current.settings.blockedDomains.filter((d) => d.id !== domainId);
    const { updateSettingsWithCooldown } = await getFsApi();
    const res = await updateSettingsWithCooldown(current, { blockedDomains: nextDomains });
    set({ userDoc: res.nextDoc, lastSyncAt: Date.now() });
    acousticEngine.playTick();
    return { cooldownScheduled: res.cooldownScheduled, message: res.message };
  },

  mintSessionCredits: async (minutes, taskLabel, strictStake, debriefSummary) => {
    const current = get().userDoc;
    if (!current) return { mintedCR: 0, txHash: '' };
    const { mintFocusCredits, fetchUserCircles } = await getFsApi();
    const res = await mintFocusCredits(current, minutes, taskLabel, strictStake, debriefSummary);
    set({ userDoc: res.nextDoc, lastSyncAt: Date.now() });
    if (get().profile) {
      const updatedCircles = await fetchUserCircles(get().profile!);
      set({ circles: updatedCircles });
    }
    return { mintedCR: res.mintedCR, txHash: res.txHash };
  },

  applyAbandonPenalty: async (taskLabel) => {
    const current = get().userDoc;
    if (!current) return 0;
    const { applyAbandonPenalty } = await getFsApi();
    const { nextDoc, penaltyCR } = await applyAbandonPenalty(current, taskLabel);
    set({ userDoc: nextDoc, lastSyncAt: Date.now() });
    acousticEngine.playPassExpiredTone('Strict Stake');
    return penaltyCR;
  },

  setFocusSession: async (session) => {
    const current = get().userDoc;
    if (!current) return;
    const { updateActiveFocusState, fetchUserCircles } = await getFsApi();
    const nextDoc = await updateActiveFocusState(current, session);
    set({ userDoc: nextDoc, lastSyncAt: Date.now() });
    if (get().profile) {
      const updatedCircles = await fetchUserCircles(get().profile!);
      set({ circles: updatedCircles });
    }
  },

  patchSettings: async (patch) => {
    const current = get().userDoc;
    if (!current) return { cooldownScheduled: false, message: 'No active session' };
    const { updateSettingsWithCooldown } = await getFsApi();
    const res = await updateSettingsWithCooldown(current, patch);
    acousticEngine.configure({
      enabled: res.nextDoc.settings.soundEnabled,
      volume: res.nextDoc.settings.soundVolume,
      style: res.nextDoc.settings.ringtoneStyle,
    });
    set({ userDoc: res.nextDoc, lastSyncAt: Date.now() });
    acousticEngine.playTick();
    return { cooldownScheduled: res.cooldownScheduled, message: res.message };
  },

  exportLedgerJson: () => {
    const doc = get().userDoc;
    if (!doc || typeof window === 'undefined') return;
    const payload = JSON.stringify(
      {
        uid: doc.profile.uid,
        wallet: doc.wallet,
        ledger: doc.ledger,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chronos-ledger-${doc.profile.uid}.json`;
    a.click();
    URL.revokeObjectURL(url);
    acousticEngine.playTick();
  },

  refreshCircles: async () => {
    const p = get().profile;
    if (!p) return;
    const { fetchUserCircles } = await getFsApi();
    const list = await fetchUserCircles(p);
    set({ circles: list });
  },

  createCircle: async (name) => {
    const p = get().profile;
    if (!p) return null;
    const { createStudyCircle } = await getFsApi();
    const created = await createStudyCircle(p, name);
    set((s) => ({ circles: [created, ...s.circles] }));
    acousticEngine.playTick();
    return created;
  },

  joinCircle: async (code) => {
    const p = get().profile;
    if (!p) return { ok: false, error: 'Sign in required' };
    const { joinStudyCircle } = await getFsApi();
    const res = await joinStudyCircle(p, code);
    if (res.ok && res.circle) {
      await get().refreshCircles();
      acousticEngine.playTick();
    }
    return { ok: res.ok, error: res.error };
  },

  pulseFocus: async (isFocusing, taskTag) => {
    const p = get().profile;
    if (!p) return;
    const { pulseCircleFocus } = await getFsApi();
    await pulseCircleFocus(p, isFocusing, taskTag, 0);
    await get().refreshCircles();
  },
}));
