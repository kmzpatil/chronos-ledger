import {
  GoogleAuthProvider,
  EmailAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  linkWithPopup,
  linkWithCredential,
  updateProfile,
  onIdTokenChanged,
  signOut,
  User,
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from './client';
import { UserProfile } from '../../types/chronos';

const LOCAL_SESSION_KEY = 'chronos_local_profile_v1';

function toUserProfile(u: User): UserProfile {
  return {
    uid: u.uid,
    displayName: u.displayName || (u.isAnonymous ? 'Guest Scholar' : 'Chronos User'),
    email: u.email,
    photoURL: u.photoURL,
    isAnonymous: u.isAnonymous,
    createdAt: u.metadata.creationTime ? Date.parse(u.metadata.creationTime) : Date.now(),
  };
}

async function syncServerSessionCookie(payload: {
  idToken?: string;
  localUid?: string;
  email?: string | null;
  isAnonymous?: boolean;
}) {
  try {
    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('[Session Bridge] Could not update __session cookie:', err);
  }
}

export async function clearServerSessionCookie() {
  try {
    await fetch('/api/auth/session', { method: 'DELETE' });
  } catch {
    // ignore
  }
}

export function loadLocalProfile(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

function saveLocalProfile(profile: UserProfile | null) {
  if (typeof window === 'undefined') return;
  if (!profile) {
    localStorage.removeItem(LOCAL_SESSION_KEY);
  } else {
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(profile));
  }
  window.dispatchEvent(new CustomEvent('chronos-local-auth-changed', { detail: profile }));
}

export function subscribeAuthState(callback: (profile: UserProfile | null) => void): () => void {
  const auth = getFirebaseAuth();

  if (auth && isFirebaseConfigured()) {
    return onIdTokenChanged(auth, async (user) => {
      if (!user) {
        callback(null);
        return;
      }
      const idToken = await user.getIdToken();
      await syncServerSessionCookie({
        idToken,
        localUid: user.uid,
        email: user.email,
        isAnonymous: user.isAnonymous,
      });
      callback(toUserProfile(user));
    });
  }

  // Local-first mode when Firebase env vars are not yet configured
  const existing = loadLocalProfile();
  if (existing) {
    syncServerSessionCookie({
      localUid: existing.uid,
      email: existing.email,
      isAnonymous: existing.isAnonymous,
    });
  }
  callback(existing);

  const handler = (e: Event) => {
    const custom = e as CustomEvent<UserProfile | null>;
    callback(custom.detail);
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('chronos-local-auth-changed', handler);
    return () => window.removeEventListener('chronos-local-auth-changed', handler);
  }
  return () => {};
}

export async function signInWithGoogle(): Promise<UserProfile> {
  const auth = getFirebaseAuth();
  if (auth && isFirebaseConfigured()) {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const idToken = await cred.user.getIdToken();
    await syncServerSessionCookie({
      idToken,
      localUid: cred.user.uid,
      email: cred.user.email,
      isAnonymous: false,
    });
    return toUserProfile(cred.user);
  }

  // Local-first fallback if Firebase env vars are blank
  const prev = loadLocalProfile();
  const profile: UserProfile = {
    uid: prev?.uid || `usr_google_${Date.now()}`,
    displayName: 'Kratos Patil',
    email: 'kratos@chronos.app',
    photoURL: null,
    isAnonymous: false,
    createdAt: prev?.createdAt || Date.now(),
  };
  saveLocalProfile(profile);
  await syncServerSessionCookie({
    localUid: profile.uid,
    email: profile.email,
    isAnonymous: false,
  });
  return profile;
}

export async function signInWithEmail(email: string, password: string): Promise<UserProfile> {
  const auth = getFirebaseAuth();
  if (auth && isFirebaseConfigured()) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await cred.user.getIdToken();
    await syncServerSessionCookie({
      idToken,
      localUid: cred.user.uid,
      email: cred.user.email,
      isAnonymous: false,
    });
    return toUserProfile(cred.user);
  }

  const prev = loadLocalProfile();
  const profile: UserProfile = {
    uid: prev?.uid || `usr_${email.replace(/[^a-z0-9]/gi, '').slice(0, 12)}`,
    displayName: email.split('@')[0],
    email,
    photoURL: null,
    isAnonymous: false,
    createdAt: prev?.createdAt || Date.now(),
  };
  saveLocalProfile(profile);
  await syncServerSessionCookie({
    localUid: profile.uid,
    email: profile.email,
    isAnonymous: false,
  });
  return profile;
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<UserProfile> {
  const auth = getFirebaseAuth();
  if (auth && isFirebaseConfigured()) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
    const idToken = await cred.user.getIdToken();
    await syncServerSessionCookie({
      idToken,
      localUid: cred.user.uid,
      email: cred.user.email,
      isAnonymous: false,
    });
    return toUserProfile(cred.user);
  }

  const profile: UserProfile = {
    uid: `usr_${Date.now()}`,
    displayName: displayName || email.split('@')[0],
    email,
    photoURL: null,
    isAnonymous: false,
    createdAt: Date.now(),
  };
  saveLocalProfile(profile);
  await syncServerSessionCookie({
    localUid: profile.uid,
    email: profile.email,
    isAnonymous: false,
  });
  return profile;
}

export async function continueAsGuest(): Promise<UserProfile> {
  const auth = getFirebaseAuth();
  if (auth && isFirebaseConfigured()) {
    const cred = await signInAnonymously(auth);
    const idToken = await cred.user.getIdToken();
    await syncServerSessionCookie({
      idToken,
      localUid: cred.user.uid,
      email: null,
      isAnonymous: true,
    });
    return toUserProfile(cred.user);
  }

  const existing = loadLocalProfile();
  if (existing) {
    await syncServerSessionCookie({
      localUid: existing.uid,
      email: existing.email,
      isAnonymous: existing.isAnonymous,
    });
    return existing;
  }

  const guest: UserProfile = {
    uid: `guest_${Math.random().toString(36).slice(2, 10)}`,
    displayName: 'Guest Scholar',
    email: null,
    photoURL: null,
    isAnonymous: true,
    createdAt: Date.now(),
  };
  saveLocalProfile(guest);
  await syncServerSessionCookie({
    localUid: guest.uid,
    email: null,
    isAnonymous: true,
  });
  return guest;
}

export async function upgradeGuestWithGoogle(): Promise<UserProfile> {
  const auth = getFirebaseAuth();
  if (auth?.currentUser && isFirebaseConfigured()) {
    const provider = new GoogleAuthProvider();
    const cred = await linkWithPopup(auth.currentUser, provider);
    const idToken = await cred.user.getIdToken(true);
    await syncServerSessionCookie({
      idToken,
      localUid: cred.user.uid,
      email: cred.user.email,
      isAnonymous: false,
    });
    return toUserProfile(cred.user);
  }

  // Preserve guest uid & credits when linking locally
  const current = loadLocalProfile();
  const upgraded: UserProfile = {
    uid: current?.uid || `usr_upgraded_${Date.now()}`,
    displayName: 'Kratos Patil',
    email: 'kratos@chronos.app',
    photoURL: null,
    isAnonymous: false,
    createdAt: current?.createdAt || Date.now(),
  };
  saveLocalProfile(upgraded);
  await syncServerSessionCookie({
    localUid: upgraded.uid,
    email: upgraded.email,
    isAnonymous: false,
  });
  return upgraded;
}

export async function upgradeGuestWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<UserProfile> {
  const auth = getFirebaseAuth();
  if (auth?.currentUser && isFirebaseConfigured()) {
    const credential = EmailAuthProvider.credential(email, password);
    const cred = await linkWithCredential(auth.currentUser, credential);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
    const idToken = await cred.user.getIdToken(true);
    await syncServerSessionCookie({
      idToken,
      localUid: cred.user.uid,
      email: cred.user.email,
      isAnonymous: false,
    });
    return toUserProfile(cred.user);
  }

  const current = loadLocalProfile();
  const upgraded: UserProfile = {
    uid: current?.uid || `usr_upgraded_${Date.now()}`,
    displayName: displayName || email.split('@')[0],
    email,
    photoURL: null,
    isAnonymous: false,
    createdAt: current?.createdAt || Date.now(),
  };
  saveLocalProfile(upgraded);
  await syncServerSessionCookie({
    localUid: upgraded.uid,
    email: upgraded.email,
    isAnonymous: false,
  });
  return upgraded;
}

export async function signOutChronos(): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth && isFirebaseConfigured()) {
    await signOut(auth);
  }
  saveLocalProfile(null);
  await clearServerSessionCookie();
}
