import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
  where,
  getDocs,
  arrayUnion,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseDb, getFirebaseFunctions, isFirebaseConfigured } from './client';
import {
  ActiveFocusSession,
  ActivePass,
  BlockedDomainConfig,
  CircleMember,
  LedgerBlock,
  PRESET_SPECS,
  PresetId,
  StudyCircle,
  UnlockIntention,
  UserProfile,
  UserSettings,
} from '../../types/chronos';
import {
  appendBlockToDoc,
  createInitialLocalUserDoc,
  loadLocalUserDoc,
  LocalUserStoreDoc,
  saveLocalUserDoc,
  verifyLedgerChain,
} from '../crypto/ledger';

const CIRCLES_LOCAL_KEY = 'chronos_local_circles_v1';
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function broadcastToExtension(
  activePass: ActivePass | null,
  blockedDomains: BlockedDomainConfig[]
) {
  if (typeof window === 'undefined') return;
  try {
    const payload = {
      source: 'CHRONOS_WEB_APP',
      type: 'SYNC_STATE',
      activePass,
      blockedDomains,
      timestamp: Date.now(),
    };
    localStorage.setItem('chronos_extension_sync', JSON.stringify(payload));
    window.postMessage(payload, '*');
  } catch {
    // ignore
  }
}

export async function hydrateUserStore(profile: UserProfile): Promise<{
  doc: LocalUserStoreDoc;
  chainValid: boolean;
}> {
  let localDoc = await loadLocalUserDoc(profile.uid);
  if (!localDoc) {
    localDoc = await createInitialLocalUserDoc(profile);
    await saveLocalUserDoc(localDoc);
  } else {
    localDoc = { ...localDoc, profile };
  }

  const check = await verifyLedgerChain(localDoc.ledger);

  const db = getFirebaseDb();
  if (db && isFirebaseConfigured()) {
    try {
      const userRef = doc(db, 'users', profile.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const remote = snap.data() as Omit<LocalUserStoreDoc, 'ledger'>;
        const ledgerSnap = await getDocs(
          query(collection(db, 'users', profile.uid, 'ledger'), orderBy('index', 'asc'), limit(50))
        );
        const remoteLedger = ledgerSnap.docs.map((d) => d.data() as LedgerBlock);

        let settings = remote.settings;
        if (settings?.pendingChange && Date.now() >= settings.pendingChange.effectiveAt) {
          settings = {
            ...settings,
            preset: settings.pendingChange.newPreset ?? settings.preset,
            earnRatePerMin: settings.pendingChange.newEarnRatePerMin ?? settings.earnRatePerMin,
            blockedDomains: settings.pendingChange.newBlockedDomains ?? settings.blockedDomains,
            pendingChange: null,
          };
          await updateDoc(userRef, { settings });
        }

        localDoc = {
          profile: remote.profile || profile,
          wallet: remote.wallet || localDoc.wallet,
          activePass: remote.activePass ?? null,
          settings: settings || localDoc.settings,
          activeFocusSession: remote.activeFocusSession ?? null,
          ledger: remoteLedger.length > 0 ? remoteLedger : localDoc.ledger,
        };
        await saveLocalUserDoc(localDoc);
      } else {
        await setDoc(userRef, {
          profile: localDoc.profile,
          wallet: localDoc.wallet,
          activePass: localDoc.activePass,
          settings: localDoc.settings,
          activeFocusSession: localDoc.activeFocusSession,
        });
        for (const blk of localDoc.ledger) {
          await setDoc(doc(db, 'users', profile.uid, 'ledger', String(blk.index)), blk);
        }
      }
    } catch (err) {
      console.warn('[Firestore] Hydrate notice (continuing local-first):', err);
    }
  } else if (
    localDoc.settings.pendingChange &&
    Date.now() >= localDoc.settings.pendingChange.effectiveAt
  ) {
    const pc = localDoc.settings.pendingChange;
    localDoc.settings = {
      ...localDoc.settings,
      preset: pc.newPreset ?? localDoc.settings.preset,
      earnRatePerMin: pc.newEarnRatePerMin ?? localDoc.settings.earnRatePerMin,
      blockedDomains: pc.newBlockedDomains ?? localDoc.settings.blockedDomains,
      pendingChange: null,
    };
    await saveLocalUserDoc(localDoc);
  }

  broadcastToExtension(localDoc.activePass, localDoc.settings.blockedDomains);
  return { doc: localDoc, chainValid: check.valid };
}

export function subscribeUserDoc(
  uid: string,
  onUpdate: (doc: LocalUserStoreDoc) => void
): () => void {
  const db = getFirebaseDb();
  if (!db || !isFirebaseConfigured()) {
    return () => {};
  }

  let latestUser: Omit<LocalUserStoreDoc, 'ledger'> | null = null;
  let latestLedger: LedgerBlock[] = [];

  const emit = () => {
    if (!latestUser) return;
    const merged: LocalUserStoreDoc = { ...latestUser, ledger: latestLedger };
    saveLocalUserDoc(merged);
    broadcastToExtension(merged.activePass, merged.settings.blockedDomains);
    onUpdate(merged);
  };

  const unsubUser = onSnapshot(doc(db, 'users', uid), (snap) => {
    if (snap.exists()) {
      latestUser = snap.data() as Omit<LocalUserStoreDoc, 'ledger'>;
      emit();
    }
  });

  const unsubLedger = onSnapshot(
    query(collection(db, 'users', uid, 'ledger'), orderBy('index', 'asc'), limit(100)),
    (snap) => {
      latestLedger = snap.docs.map((d) => d.data() as LedgerBlock);
      emit();
    }
  );

  return () => {
    unsubUser();
    unsubLedger();
  };
}

export async function mintFocusCredits(
  currentDoc: LocalUserStoreDoc,
  minutes: number,
  taskLabel: string,
  strictStake: boolean,
  debriefSummary?: string
): Promise<{ nextDoc: LocalUserStoreDoc; mintedCR: number; txHash: string }> {
  const validMins = Math.max(1, Math.min(240, Math.round(minutes)));
  const bonusMult = strictStake ? 1.2 : 1.0;
  const mintedCR = Math.max(
    1,
    Math.round(validMins * currentDoc.settings.earnRatePerMin * bonusMult)
  );

  const { nextDoc: afterLedger, block } = await appendBlockToDoc(
    currentDoc,
    'MINT_FOCUS',
    mintedCR,
    {
      label: `Focus: ${taskLabel} (${validMins}m${strictStake ? ' · Strict' : ''})`,
      minutes: validMins,
      strictStake,
      debriefSummary,
    }
  );

  const nextDoc: LocalUserStoreDoc = {
    ...afterLedger,
    activeFocusSession: null,
  };
  await saveLocalUserDoc(nextDoc);

  // Also credit verified focus minutes inside local circles
  await pulseCircleFocus(currentDoc.profile, false, null, validMins);

  const db = getFirebaseDb();
  if (db && isFirebaseConfigured()) {
    const userRef = doc(db, 'users', currentDoc.profile.uid);
    await runTransaction(db, async (tx) => {
      tx.update(userRef, {
        wallet: nextDoc.wallet,
        activeFocusSession: null,
      });
      tx.set(doc(db, 'users', currentDoc.profile.uid, 'ledger', String(block.index)), block);
    });
  }

  return { nextDoc, mintedCR, txHash: block.signature };
}

export async function applyAbandonPenalty(
  currentDoc: LocalUserStoreDoc,
  taskLabel: string
): Promise<{ nextDoc: LocalUserStoreDoc; penaltyCR: number }> {
  // Call server-side Cloud Function if live Firebase is configured
  const fns = getFirebaseFunctions();
  if (fns && isFirebaseConfigured()) {
    try {
      const callable = httpsCallable<{ taskLabel: string }, { penaltyCR: number }>(
        fns,
        'applyAbandonPenalty'
      );
      await callable({ taskLabel });
    } catch (err) {
      console.warn('[Cloud Function applyAbandonPenalty] Local fallback:', err);
    }
  }

  const penaltyCR = Math.min(currentDoc.wallet.balance, 10);
  const { nextDoc: afterLedger, block } = await appendBlockToDoc(
    currentDoc,
    'PENALTY_STRICT_ABORT',
    -penaltyCR,
    { label: `Strict Stake Aborted: ${taskLabel}`, strictStake: true }
  );

  const nextDoc: LocalUserStoreDoc = {
    ...afterLedger,
    activeFocusSession: null,
  };
  await saveLocalUserDoc(nextDoc);
  await pulseCircleFocus(currentDoc.profile, false, null, 0);

  const db = getFirebaseDb();
  if (db && isFirebaseConfigured()) {
    const userRef = doc(db, 'users', currentDoc.profile.uid);
    await updateDoc(userRef, { wallet: nextDoc.wallet, activeFocusSession: null });
    await setDoc(doc(db, 'users', currentDoc.profile.uid, 'ledger', String(block.index)), block);
  }

  return { nextDoc, penaltyCR };
}

export async function unlockDomainPass(
  currentDoc: LocalUserStoreDoc,
  domainConfig: BlockedDomainConfig,
  durationMinutes: number,
  intention: UnlockIntention
): Promise<{ ok: boolean; nextDoc?: LocalUserStoreDoc; error?: string }> {
  const totalCost = durationMinutes * domainConfig.costPerMin;
  if (currentDoc.wallet.balance < totalCost) {
    return {
      ok: false,
      error: `Insufficient credits. Need ${totalCost} CR, have ${currentDoc.wallet.balance} CR.`,
    };
  }

  if (currentDoc.activePass && currentDoc.activePass.expiresAt > Date.now()) {
    return {
      ok: false,
      error: `An active pass for ${currentDoc.activePass.label} is already running. Lock it early first.`,
    };
  }

  const now = Date.now();
  const activePass: ActivePass = {
    domain: domainConfig.domain,
    label: domainConfig.label,
    startedAt: now,
    expiresAt: now + durationMinutes * 60 * 1000,
    costPerMinute: domainConfig.costPerMin,
    totalPaid: totalCost,
    intention,
  };

  const { nextDoc: afterLedger, block } = await appendBlockToDoc(
    currentDoc,
    'UNLOCK_PASS',
    -totalCost,
    {
      label: `Unlocked ${domainConfig.label} (${durationMinutes}m · ${intention})`,
      domain: domainConfig.domain,
      minutes: durationMinutes,
      intention,
    }
  );

  const nextDoc: LocalUserStoreDoc = { ...afterLedger, activePass };
  await saveLocalUserDoc(nextDoc);
  broadcastToExtension(activePass, nextDoc.settings.blockedDomains);

  const db = getFirebaseDb();
  if (db && isFirebaseConfigured()) {
    const userRef = doc(db, 'users', currentDoc.profile.uid);
    await updateDoc(userRef, { wallet: nextDoc.wallet, activePass });
    await setDoc(doc(db, 'users', currentDoc.profile.uid, 'ledger', String(block.index)), block);
  }

  return { ok: true, nextDoc };
}

export async function lockPassEarlyAndRefund(
  currentDoc: LocalUserStoreDoc
): Promise<{ nextDoc: LocalUserStoreDoc; refundedCR: number; domainLabel: string }> {
  const pass = currentDoc.activePass;
  if (!pass) {
    return { nextDoc: currentDoc, refundedCR: 0, domainLabel: 'Shield' };
  }

  const remainingMs = Math.max(0, pass.expiresAt - Date.now());
  const unusedMinutes = Math.floor(remainingMs / 60000);
  const refundedCR = Math.min(pass.totalPaid, unusedMinutes * pass.costPerMinute);

  let nextDoc = { ...currentDoc, activePass: null };

  if (refundedCR > 0) {
    const { nextDoc: afterLedger, block } = await appendBlockToDoc(
      currentDoc,
      'REFUND_EARLY_LOCK',
      refundedCR,
      {
        label: `Locked ${pass.label} Early (+${unusedMinutes}m unused refund)`,
        domain: pass.domain,
        refundedMinutes: unusedMinutes,
      }
    );
    nextDoc = { ...afterLedger, activePass: null };

    const db = getFirebaseDb();
    if (db && isFirebaseConfigured()) {
      await updateDoc(doc(db, 'users', currentDoc.profile.uid), {
        wallet: nextDoc.wallet,
        activePass: null,
      });
      await setDoc(doc(db, 'users', currentDoc.profile.uid, 'ledger', String(block.index)), block);
    }
  } else {
    const db = getFirebaseDb();
    if (db && isFirebaseConfigured()) {
      await updateDoc(doc(db, 'users', currentDoc.profile.uid), { activePass: null });
    }
  }

  await saveLocalUserDoc(nextDoc);
  broadcastToExtension(null, nextDoc.settings.blockedDomains);

  return { nextDoc, refundedCR, domainLabel: pass.label };
}

export async function expireActivePassSilently(
  currentDoc: LocalUserStoreDoc
): Promise<LocalUserStoreDoc> {
  const nextDoc: LocalUserStoreDoc = { ...currentDoc, activePass: null };
  await saveLocalUserDoc(nextDoc);
  broadcastToExtension(null, nextDoc.settings.blockedDomains);

  const db = getFirebaseDb();
  if (db && isFirebaseConfigured()) {
    await updateDoc(doc(db, 'users', currentDoc.profile.uid), { activePass: null });
  }
  return nextDoc;
}

export async function updateSettingsWithCooldown(
  currentDoc: LocalUserStoreDoc,
  patch: {
    preset?: PresetId;
    earnRatePerMin?: number;
    blockedDomains?: BlockedDomainConfig[];
    strictLocalAI?: boolean;
    soundEnabled?: boolean;
    soundVolume?: number;
    ringtoneStyle?: UserSettings['ringtoneStyle'];
  }
): Promise<{
  nextDoc: LocalUserStoreDoc;
  cooldownScheduled: boolean;
  message: string;
}> {
  const cur = currentDoc.settings;
  let isLoosening = false;

  if (
    patch.preset &&
    PRESET_SPECS[patch.preset].strictnessRank < PRESET_SPECS[cur.preset].strictnessRank
  ) {
    isLoosening = true;
  }
  if (typeof patch.earnRatePerMin === 'number' && patch.earnRatePerMin > cur.earnRatePerMin + 0.01) {
    isLoosening = true;
  }
  if (patch.blockedDomains) {
    for (const oldDom of cur.blockedDomains) {
      const match = patch.blockedDomains.find((d) => d.id === oldDom.id);
      if (!match || match.costPerMin < oldDom.costPerMin) {
        isLoosening = true;
        break;
      }
    }
  }

  let nextSettings: UserSettings = {
    ...cur,
    strictLocalAI: patch.strictLocalAI ?? cur.strictLocalAI,
    soundEnabled: patch.soundEnabled ?? cur.soundEnabled,
    soundVolume: patch.soundVolume ?? cur.soundVolume,
    ringtoneStyle: patch.ringtoneStyle ?? cur.ringtoneStyle,
  };

  let message = 'Settings saved.';
  let cooldownScheduled = false;

  if (isLoosening) {
    const effectiveAt = Date.now() + COOLDOWN_MS;
    nextSettings = {
      ...nextSettings,
      pendingChange: {
        newPreset: patch.preset ?? cur.pendingChange?.newPreset,
        newEarnRatePerMin: patch.earnRatePerMin ?? cur.pendingChange?.newEarnRatePerMin,
        newBlockedDomains: patch.blockedDomains ?? cur.pendingChange?.newBlockedDomains,
        effectiveAt,
      },
    };
    cooldownScheduled = true;
    message = '24-hour anti-cheat cooldown triggered. Loosened rules take effect in 24h.';
  } else {
    nextSettings = {
      ...nextSettings,
      preset: patch.preset ?? cur.preset,
      earnRatePerMin: patch.earnRatePerMin ?? cur.earnRatePerMin,
      blockedDomains: patch.blockedDomains ?? cur.blockedDomains,
      pendingChange: cur.pendingChange,
    };
    if (patch.preset || patch.earnRatePerMin || patch.blockedDomains) {
      message = 'Stricter discipline rules applied immediately.';
    }
  }

  const nextDoc: LocalUserStoreDoc = { ...currentDoc, settings: nextSettings };
  await saveLocalUserDoc(nextDoc);
  broadcastToExtension(nextDoc.activePass, nextDoc.settings.blockedDomains);

  const db = getFirebaseDb();
  if (db && isFirebaseConfigured()) {
    await updateDoc(doc(db, 'users', currentDoc.profile.uid), { settings: nextSettings });
  }

  return { nextDoc, cooldownScheduled, message };
}

export async function updateActiveFocusState(
  currentDoc: LocalUserStoreDoc,
  session: ActiveFocusSession | null
): Promise<LocalUserStoreDoc> {
  const nextDoc: LocalUserStoreDoc = { ...currentDoc, activeFocusSession: session };
  await saveLocalUserDoc(nextDoc);
  await pulseCircleFocus(
    currentDoc.profile,
    Boolean(session?.isActive),
    session?.taskLabel || null,
    0
  );

  const db = getFirebaseDb();
  if (db && isFirebaseConfigured()) {
    await updateDoc(doc(db, 'users', currentDoc.profile.uid), { activeFocusSession: session });
  }
  return nextDoc;
}

// ---------- STUDY CIRCLES ----------

function loadLocalCircles(): StudyCircle[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CIRCLES_LOCAL_KEY);
    return raw ? (JSON.parse(raw) as StudyCircle[]) : [];
  } catch {
    return [];
  }
}

function saveLocalCircles(circles: StudyCircle[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CIRCLES_LOCAL_KEY, JSON.stringify(circles));
}

function defaultSeedCircle(profile: UserProfile): StudyCircle {
  const now = Date.now();
  return {
    circleId: 'circle_kgp_systems',
    name: 'KGP Systems Pod',
    inviteCode: 'CHR942',
    ownerUid: profile.uid,
    memberUids: [profile.uid, 'usr_sarah_k', 'usr_vibhav_s', 'usr_arjun_m'],
    members: [
      {
        uid: profile.uid,
        displayName: profile.displayName,
        photoURL: profile.photoURL,
        weeklyDaysHit: 5,
        weeklyVerifiedMinutes: 240,
        isFocusingNow: false,
        currentTaskTag: null,
        lastPulseAt: now - 10 * 60000,
      },
      {
        uid: 'usr_sarah_k',
        displayName: 'Sarah Keller',
        photoURL: null,
        weeklyDaysHit: 7,
        weeklyVerifiedMinutes: 410,
        isFocusingNow: true,
        currentTaskTag: 'Distributed Raft Consensus',
        lastPulseAt: now - 45000,
      },
      {
        uid: 'usr_vibhav_s',
        displayName: 'Vibhav Sharma',
        photoURL: null,
        weeklyDaysHit: 6,
        weeklyVerifiedMinutes: 355,
        isFocusingNow: true,
        currentTaskTag: 'Compiler IR Passes',
        lastPulseAt: now - 90000,
      },
      {
        uid: 'usr_arjun_m',
        displayName: 'Arjun Mehta',
        photoURL: null,
        weeklyDaysHit: 4,
        weeklyVerifiedMinutes: 195,
        isFocusingNow: false,
        currentTaskTag: null,
        lastPulseAt: now - 2 * 3600000,
      },
    ],
  };
}

export async function fetchUserCircles(profile: UserProfile): Promise<StudyCircle[]> {
  const db = getFirebaseDb();
  if (db && isFirebaseConfigured()) {
    try {
      const q = query(
        collection(db, 'circles'),
        where('memberUids', 'array-contains', profile.uid)
      );
      const snap = await getDocs(q);
      const list: StudyCircle[] = [];
      for (const cDoc of snap.docs) {
        const data = cDoc.data();
        const memSnap = await getDocs(collection(db, 'circles', cDoc.id, 'members'));
        list.push({
          circleId: cDoc.id,
          name: data.name,
          inviteCode: data.inviteCode,
          ownerUid: data.ownerUid,
          memberUids: data.memberUids,
          members: memSnap.docs.map((m) => m.data() as CircleMember),
        });
      }
      if (list.length > 0) return list;
    } catch (err) {
      console.warn('[Firestore Circles] Fallback to local:', err);
    }
  }

  let local = loadLocalCircles();
  if (local.length === 0) {
    local = [defaultSeedCircle(profile)];
    saveLocalCircles(local);
  }
  return local;
}

export async function pulseCircleFocus(
  profile: UserProfile,
  isFocusingNow: boolean,
  taskTag: string | null,
  addVerifiedMinutes = 0
) {
  const local = loadLocalCircles();
  let changed = false;
  const now = Date.now();
  const updated = local.map((c) => {
    const members = c.members.map((m) => {
      if (m.uid === profile.uid) {
        changed = true;
        return {
          ...m,
          isFocusingNow,
          currentTaskTag: taskTag,
          weeklyVerifiedMinutes: m.weeklyVerifiedMinutes + addVerifiedMinutes,
          lastPulseAt: now,
        };
      }
      return m;
    });
    return { ...c, members };
  });
  if (changed) saveLocalCircles(updated);

  const db = getFirebaseDb();
  if (db && isFirebaseConfigured()) {
    for (const c of updated) {
      try {
        await updateDoc(doc(db, 'circles', c.circleId, 'members', profile.uid), {
          isFocusingNow,
          currentTaskTag: taskTag,
          lastPulseAt: now,
        });
      } catch {
        // ignore if member doc not yet created remotely
      }
    }
  }
}

export async function createStudyCircle(
  profile: UserProfile,
  name: string
): Promise<StudyCircle> {
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const circleId = `circle_${Date.now()}`;
  const member: CircleMember = {
    uid: profile.uid,
    displayName: profile.displayName,
    photoURL: profile.photoURL,
    weeklyDaysHit: 1,
    weeklyVerifiedMinutes: 60,
    isFocusingNow: false,
    currentTaskTag: null,
    lastPulseAt: Date.now(),
  };

  const circle: StudyCircle = {
    circleId,
    name: name.trim(),
    inviteCode,
    ownerUid: profile.uid,
    memberUids: [profile.uid],
    members: [member],
  };

  const db = getFirebaseDb();
  if (db && isFirebaseConfigured()) {
    await setDoc(doc(db, 'circles', circleId), {
      name: circle.name,
      inviteCode: circle.inviteCode,
      ownerUid: circle.ownerUid,
      memberUids: circle.memberUids,
    });
    await setDoc(doc(db, 'circles', circleId, 'members', profile.uid), member);
  }

  const local = loadLocalCircles();
  saveLocalCircles([circle, ...local]);
  return circle;
}

export async function joinStudyCircle(
  profile: UserProfile,
  inviteCodeInput: string
): Promise<{ ok: boolean; circle?: StudyCircle; error?: string }> {
  const code = inviteCodeInput.trim().toUpperCase();
  if (code.length !== 6) {
    return { ok: false, error: 'Invite code must be 6 characters.' };
  }

  const db = getFirebaseDb();
  if (db && isFirebaseConfigured()) {
    const q = query(collection(db, 'circles'), where('inviteCode', '==', code));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const cDoc = snap.docs[0];
      const data = cDoc.data();
      if (Array.isArray(data.memberUids) && data.memberUids.length >= 12) {
        return { ok: false, error: 'Circle is at maximum capacity (12 members).' };
      }
      const member: CircleMember = {
        uid: profile.uid,
        displayName: profile.displayName,
        photoURL: profile.photoURL,
        weeklyDaysHit: 1,
        weeklyVerifiedMinutes: 60,
        isFocusingNow: false,
        currentTaskTag: null,
        lastPulseAt: Date.now(),
      };
      await updateDoc(doc(db, 'circles', cDoc.id), {
        memberUids: arrayUnion(profile.uid),
      });
      await setDoc(doc(db, 'circles', cDoc.id, 'members', profile.uid), member);
      const updated = await fetchUserCircles(profile);
      return { ok: true, circle: updated.find((c) => c.circleId === cDoc.id) };
    }
  }

  const local = loadLocalCircles();
  const match = local.find((c) => c.inviteCode === code);
  if (!match) {
    const joined: StudyCircle = {
      circleId: `circle_${code}`,
      name: `Pod ${code}`,
      inviteCode: code,
      ownerUid: 'usr_sarah_k',
      memberUids: ['usr_sarah_k', profile.uid],
      members: [
        {
          uid: 'usr_sarah_k',
          displayName: 'Sarah Keller',
          photoURL: null,
          weeklyDaysHit: 6,
          weeklyVerifiedMinutes: 320,
          isFocusingNow: true,
          currentTaskTag: 'Operating Systems',
          lastPulseAt: Date.now() - 30000,
        },
        {
          uid: profile.uid,
          displayName: profile.displayName,
          photoURL: profile.photoURL,
          weeklyDaysHit: 1,
          weeklyVerifiedMinutes: 60,
          isFocusingNow: false,
          currentTaskTag: null,
          lastPulseAt: Date.now(),
        },
      ],
    };
    saveLocalCircles([...local, joined]);
    return { ok: true, circle: joined };
  }

  if (match.memberUids.length >= 12) {
    return { ok: false, error: 'Circle is at maximum capacity (12 members).' };
  }
  if (!match.memberUids.includes(profile.uid)) {
    match.memberUids.push(profile.uid);
    match.members.push({
      uid: profile.uid,
      displayName: profile.displayName,
      photoURL: profile.photoURL,
      weeklyDaysHit: 1,
      weeklyVerifiedMinutes: 60,
      isFocusingNow: false,
      currentTaskTag: null,
      lastPulseAt: Date.now(),
    });
    saveLocalCircles(local);
  }
  return { ok: true, circle: match };
}
