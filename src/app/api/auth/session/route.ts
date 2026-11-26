import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  createSessionFromIdToken,
  isFirebaseAdminConfigured,
  signLocalSessionToken,
  verifyServerSession,
} from '../../../../lib/firebase/admin';

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
const SESSION_COOKIE_NAME = '__session';

export async function GET() {
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifyServerSession(cookieVal);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, session });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { idToken, localUid, email, isAnonymous } = body as {
      idToken?: string;
      localUid?: string;
      email?: string | null;
      isAnonymous?: boolean;
    };

    let sessionCookieValue: string | null = null;

    if (idToken && isFirebaseAdminConfigured()) {
      sessionCookieValue = await createSessionFromIdToken(idToken, FIVE_DAYS_MS);
    } else if (localUid) {
      sessionCookieValue = signLocalSessionToken({
        uid: localUid,
        email: email ?? null,
        isAnonymous: Boolean(isAnonymous),
        exp: Date.now() + FIVE_DAYS_MS,
      });
    } else if (idToken) {
      // Fallback if client Firebase is configured without Admin service account
      sessionCookieValue = signLocalSessionToken({
        uid: localUid || `usr_${Date.now()}`,
        email: email ?? null,
        isAnonymous: Boolean(isAnonymous),
        exp: Date.now() + FIVE_DAYS_MS,
      });
    }

    if (!sessionCookieValue) {
      return NextResponse.json(
        { ok: false, error: 'Missing idToken or localUid' },
        { status: 400 }
      );
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE_NAME, sessionCookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(FIVE_DAYS_MS / 1000),
    });

    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Session error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
