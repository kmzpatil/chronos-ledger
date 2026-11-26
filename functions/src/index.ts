import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Transaction } from 'firebase-admin/firestore';
import * as crypto from 'crypto';

initializeApp();
const db = getFirestore();

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

function signLedgerBlock(
  prevHash: string,
  index: number,
  timestamp: number,
  type: string,
  amount: number,
  label: string
): string {
  const secret = process.env.SESSION_HMAC_SECRET || 'chronos-cloud-hmac-secret';
  const payload = `${prevHash}|${index}|${timestamp}|${type}|${amount}|${label}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export const mintSessionCredits = onCall(
  { enforceAppCheck: true },
  async (req: CallableRequest<{ minutes: number; taskLabel: string; strictStake: boolean }>) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Authentication required.');
    const uid = req.auth.uid;
    const { minutes, taskLabel, strictStake } = req.data;

    if (typeof minutes !== 'number' || minutes < 1 || minutes > 240) {
      throw new HttpsError('invalid-argument', 'Focus duration must be 1..240 minutes.');
    }

    const userRef = db.doc(`users/${uid}`);
    return db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new HttpsError('not-found', 'User ledger not initialized.');
      const data = snap.data()!;
      const rate = Number(data.settings?.earnRatePerMin ?? 1.0);
      const mult = strictStake ? 1.2 : 1.0;
      const mintedCR = Math.max(1, Math.round(minutes * rate * mult));

      const index = Number(data.wallet?.lastBlockIndex ?? -1) + 1;
      const prevHash = String(data.wallet?.lastBlockHash ?? 'GENESIS_CHRONOS_V1');
      const now = Date.now();
      const label = `Focus: ${taskLabel || 'Deep Work'} (${minutes}m)`;
      const signature = signLedgerBlock(prevHash, index, now, 'MINT_FOCUS', mintedCR, label);

      const newBalance = Number(data.wallet?.balance ?? 0) + mintedCR;
      const newLifetime = Number(data.wallet?.lifetimeMinted ?? 0) + mintedCR;

      tx.update(userRef, {
        'wallet.balance': newBalance,
        'wallet.lifetimeMinted': newLifetime,
        'wallet.lastBlockIndex': index,
        'wallet.lastBlockHash': signature,
        'wallet.updatedAt': now,
        activeFocusSession: null,
      });

      tx.set(db.doc(`users/${uid}/ledger/${index}`), {
        index,
        timestamp: now,
        type: 'MINT_FOCUS',
        amount: mintedCR,
        metadata: { label, minutes, strictStake: Boolean(strictStake) },
        prevHash,
        signature,
      });

      return { ok: true, mintedCR, balance: newBalance };
    });
  }
);

export const applyAbandonPenalty = onCall(
  { enforceAppCheck: true },
  async (req: CallableRequest<{ taskLabel: string }>) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Authentication required.');
    const uid = req.auth.uid;
    const { taskLabel } = req.data;
    const userRef = db.doc(`users/${uid}`);

    return db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new HttpsError('not-found', 'User ledger missing.');
      const data = snap.data()!;
      const currentBal = Number(data.wallet?.balance ?? 0);
      const penaltyCR = Math.min(currentBal, 10);

      const index = Number(data.wallet?.lastBlockIndex ?? -1) + 1;
      const prevHash = String(data.wallet?.lastBlockHash ?? 'GENESIS_CHRONOS_V1');
      const now = Date.now();
      const label = `Strict Stake Aborted: ${taskLabel || 'Focus Session'}`;
      const signature = signLedgerBlock(
        prevHash,
        index,
        now,
        'PENALTY_STRICT_ABORT',
        -penaltyCR,
        label
      );

      tx.update(userRef, {
        'wallet.balance': currentBal - penaltyCR,
        'wallet.lastBlockIndex': index,
        'wallet.lastBlockHash': signature,
        'wallet.updatedAt': now,
        activeFocusSession: null,
      });

      tx.set(db.doc(`users/${uid}/ledger/${index}`), {
        index,
        timestamp: now,
        type: 'PENALTY_STRICT_ABORT',
        amount: -penaltyCR,
        metadata: { label, strictStake: true },
        prevHash,
        signature,
      });

      return { ok: true, penaltyCR, balance: currentBal - penaltyCR };
    });
  }
);

export const lockPassEarly = onCall({ enforceAppCheck: true }, async (req: CallableRequest<unknown>) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Authentication required.');
  const uid = req.auth.uid;
  const userRef = db.doc(`users/${uid}`);

  return db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('not-found', 'User missing.');
    const data = snap.data()!;
    const pass = data.activePass;
    if (!pass) return { ok: true, refundedCR: 0 };

    const now = Date.now();
    const unusedMinutes = Math.floor(Math.max(0, pass.expiresAt - now) / 60000);
    const refundedCR = Math.min(pass.totalPaid, unusedMinutes * pass.costPerMinute);

    const index = Number(data.wallet?.lastBlockIndex ?? -1) + 1;
    const prevHash = String(data.wallet?.lastBlockHash ?? 'GENESIS_CHRONOS_V1');
    const label = `Locked ${pass.label} Early (+${unusedMinutes}m refund)`;
    const signature = signLedgerBlock(prevHash, index, now, 'REFUND_EARLY_LOCK', refundedCR, label);
    const newBalance = Number(data.wallet?.balance ?? 0) + refundedCR;

    tx.update(userRef, {
      activePass: null,
      'wallet.balance': newBalance,
      'wallet.lastBlockIndex': index,
      'wallet.lastBlockHash': signature,
      'wallet.updatedAt': now,
    });

    tx.set(db.doc(`users/${uid}/ledger/${index}`), {
      index,
      timestamp: now,
      type: 'REFUND_EARLY_LOCK',
      amount: refundedCR,
      metadata: { label, domain: pass.domain, refundedMinutes: unusedMinutes },
      prevHash,
      signature,
    });

    return { ok: true, refundedCR, balance: newBalance };
  });
});

export const updateSettingsEnforced = onCall(
  { enforceAppCheck: true },
  async (
    req: CallableRequest<{
      earnRatePerMin?: number;
      preset?: 'CASUAL' | 'STANDARD' | 'MONK';
    }>
  ) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Authentication required.');
    const uid = req.auth.uid;
    const { earnRatePerMin, preset } = req.data;

    const userRef = db.doc(`users/${uid}`);
    const snap = await userRef.get();
    if (!snap.exists) throw new HttpsError('not-found', 'User missing.');

    const cur = snap.data()!.settings;
    const isLoosening =
      typeof earnRatePerMin === 'number' && earnRatePerMin > Number(cur.earnRatePerMin);

    if (isLoosening) {
      const effectiveAt = Date.now() + COOLDOWN_MS;
      await userRef.update({
        'settings.pendingChange': {
          newPreset: preset ?? cur.preset,
          newEarnRatePerMin: earnRatePerMin,
          effectiveAt,
        },
      });
      return { ok: true, cooldownScheduled: true, effectiveAt };
    }

    await userRef.update({
      'settings.preset': preset ?? cur.preset,
      'settings.earnRatePerMin': earnRatePerMin ?? cur.earnRatePerMin,
    });
    return { ok: true, cooldownScheduled: false };
  }
);
