import { cert, getApps, initializeApp, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';

function getSessionSecret(): string {
  return process.env.SESSION_HMAC_SECRET || 'chronos-dev-hmac-secret-change-in-production';
}

export function isFirebaseAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
  );
}

export function getAdminApp(): App | null {
  if (!isFirebaseAdminConfigured()) return null;
  if (getApps().length > 0) return getApps()[0];

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export function getAdminAuth() {
  const app = getAdminApp();
  return app ? getAuth(app) : null;
}

export function getAdminDb() {
  const app = getAdminApp();
  return app ? getFirestore(app) : null;
}

export interface VerifiedSessionPayload {
  uid: string;
  email: string | null;
  isAnonymous: boolean;
  mode: 'firebase-admin' | 'local-hmac';
}

export function signLocalSessionToken(payload: {
  uid: string;
  email: string | null;
  isAnonymous: boolean;
  exp: number;
}): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `local.${encoded}.${sig}`;
}

export function verifyLocalSessionToken(token: string): VerifiedSessionPayload | null {
  try {
    if (!token.startsWith('local.')) return null;
    const [, encoded, sig] = token.split('.');
    if (!encoded || !sig) return null;

    const expected = crypto
      .createHmac('sha256', getSessionSecret())
      .update(encoded)
      .digest('base64url');

    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

    const data = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (typeof data.exp !== 'number' || Date.now() > data.exp) return null;

    return {
      uid: data.uid,
      email: data.email ?? null,
      isAnonymous: Boolean(data.isAnonymous),
      mode: 'local-hmac',
    };
  } catch {
    return null;
  }
}

export async function createSessionFromIdToken(
  idToken: string,
  expiresInMs: number
): Promise<string | null> {
  const adminAuth = getAdminAuth();
  if (!adminAuth) return null;
  return adminAuth.createSessionCookie(idToken, { expiresIn: expiresInMs });
}

export async function verifyServerSession(
  cookieValue: string | undefined
): Promise<VerifiedSessionPayload | null> {
  if (!cookieValue) return null;

  if (cookieValue.startsWith('local.')) {
    return verifyLocalSessionToken(cookieValue);
  }

  const adminAuth = getAdminAuth();
  if (!adminAuth) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(cookieValue, true);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      isAnonymous: decoded.firebase?.sign_in_provider === 'anonymous',
      mode: 'firebase-admin',
    };
  } catch {
    return null;
  }
}
