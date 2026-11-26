import { openDB, IDBPDatabase } from 'idb';
import {
  ActiveFocusSession,
  ActivePass,
  DEFAULT_BLOCKED_DOMAINS,
  LedgerBlock,
  LedgerTxType,
  UserProfile,
  UserSettings,
  WalletState,
} from '../../types/chronos';

const DB_NAME = 'chronos-economy-v1';
const DB_VERSION = 1;
const LOCAL_HMAC_KEY_MATERIAL = 'chronos-obsidian-brass-hmac-integrity-v1';

export interface LocalUserStoreDoc {
  profile: UserProfile;
  wallet: WalletState;
  activePass: ActivePass | null;
  settings: UserSettings;
  activeFocusSession: ActiveFocusSession | null;
  ledger: LedgerBlock[];
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'profile.uid' });
        }
        if (!db.objectStoreNames.contains('circles')) {
          db.createObjectStore('circles', { keyPath: 'circleId' });
        }
      },
    });
  }
  return dbPromise;
}

async function getHmacKey(): Promise<CryptoKey | null> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return null;
  const enc = new TextEncoder();
  return window.crypto.subtle.importKey(
    'raw',
    enc.encode(LOCAL_HMAC_KEY_MATERIAL),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signBlockPayload(
  prevHash: string,
  index: number,
  timestamp: number,
  type: LedgerTxType,
  amount: number,
  label: string
): Promise<string> {
  const payload = `${prevHash}|${index}|${timestamp}|${type}|${amount}|${label}`;
  const key = await getHmacKey();
  if (!key) {
    let h = 2166136261;
    for (let i = 0; i < payload.length; i++) {
      h ^= payload.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return `fallback_${(h >>> 0).toString(16).padStart(8, '0')}`;
  }

  const enc = new TextEncoder();
  const sigBuffer = await window.crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const bytes = Array.from(new Uint8Array(sigBuffer));
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyLedgerChain(blocks: LedgerBlock[]): Promise<{
  valid: boolean;
  verifiedCount: number;
  brokenIndex: number | null;
}> {
  if (!blocks || blocks.length === 0) {
    return { valid: true, verifiedCount: 0, brokenIndex: null };
  }

  const ordered = [...blocks].sort((a, b) => a.index - b.index);
  let expectedPrev = 'GENESIS_CHRONOS_V1';

  for (let i = 0; i < ordered.length; i++) {
    const b = ordered[i];
    if (b.prevHash !== expectedPrev) {
      return { valid: false, verifiedCount: i, brokenIndex: b.index };
    }
    const recomputed = await signBlockPayload(
      b.prevHash,
      b.index,
      b.timestamp,
      b.type,
      b.amount,
      b.metadata.label
    );
    if (recomputed !== b.signature) {
      return { valid: false, verifiedCount: i, brokenIndex: b.index };
    }
    expectedPrev = b.signature;
  }

  return { valid: true, verifiedCount: ordered.length, brokenIndex: null };
}

export async function createInitialLocalUserDoc(profile: UserProfile): Promise<LocalUserStoreDoc> {
  const now = Date.now();
  const t1 = now - 3 * 3600 * 1000;
  const t2 = now - 45 * 60 * 1000;

  const sig1 = await signBlockPayload(
    'GENESIS_CHRONOS_V1',
    0,
    t1,
    'MINT_FOCUS',
    60,
    'Focus: Systems Architecture (60m)'
  );
  const sig2 = await signBlockPayload(
    sig1,
    1,
    t2,
    'UNLOCK_PASS',
    -15,
    'Unlocked Instagram (15m · Planned Break)'
  );

  const ledger: LedgerBlock[] = [
    {
      index: 0,
      timestamp: t1,
      type: 'MINT_FOCUS',
      amount: 60,
      metadata: { label: 'Focus: Systems Architecture (60m)', minutes: 60 },
      prevHash: 'GENESIS_CHRONOS_V1',
      signature: sig1,
    },
    {
      index: 1,
      timestamp: t2,
      type: 'UNLOCK_PASS',
      amount: -15,
      metadata: {
        label: 'Unlocked Instagram (15m · Planned Break)',
        domain: 'instagram.com',
        minutes: 15,
        intention: 'Planned Break',
      },
      prevHash: sig1,
      signature: sig2,
    },
  ];

  return {
    profile,
    wallet: {
      balance: 45,
      lifetimeMinted: 60,
      lastBlockIndex: 1,
      lastBlockHash: sig2,
      updatedAt: now,
    },
    activePass: null,
    settings: {
      preset: 'CASUAL',
      earnRatePerMin: 1.0,
      blockedDomains: DEFAULT_BLOCKED_DOMAINS,
      strictLocalAI: false,
      soundEnabled: true,
      soundVolume: 0.75,
      ringtoneStyle: 'BRAUN_CHIME',
      pendingChange: null,
    },
    activeFocusSession: null,
    ledger,
  };
}

export async function loadLocalUserDoc(uid: string): Promise<LocalUserStoreDoc | null> {
  if (typeof window === 'undefined') return null;
  try {
    const db = await getDb();
    const doc = await db.get('users', uid);
    return (doc as LocalUserStoreDoc) || null;
  } catch {
    return null;
  }
}

export async function saveLocalUserDoc(doc: LocalUserStoreDoc): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const db = await getDb();
    await db.put('users', doc);
  } catch (err) {
    console.warn('IndexedDB save notice:', err);
  }
}

export async function appendBlockToDoc(
  doc: LocalUserStoreDoc,
  type: LedgerTxType,
  amount: number,
  metadata: LedgerBlock['metadata']
): Promise<{ nextDoc: LocalUserStoreDoc; block: LedgerBlock }> {
  const index = doc.ledger.length;
  const prevHash =
    index === 0 ? 'GENESIS_CHRONOS_V1' : doc.ledger[index - 1].signature;
  const timestamp = Date.now();
  const signature = await signBlockPayload(
    prevHash,
    index,
    timestamp,
    type,
    amount,
    metadata.label
  );

  const block: LedgerBlock = {
    index,
    timestamp,
    type,
    amount,
    metadata,
    prevHash,
    signature,
  };

  const nextBalance = Math.max(0, doc.wallet.balance + amount);
  const nextLifetime =
    amount > 0 ? doc.wallet.lifetimeMinted + amount : doc.wallet.lifetimeMinted;

  const nextDoc: LocalUserStoreDoc = {
    ...doc,
    wallet: {
      balance: nextBalance,
      lifetimeMinted: nextLifetime,
      lastBlockIndex: index,
      lastBlockHash: signature,
      updatedAt: timestamp,
    },
    ledger: [...doc.ledger, block],
  };

  await saveLocalUserDoc(nextDoc);
  return { nextDoc, block };
}
