export type PresetId = 'CASUAL' | 'STANDARD' | 'MONK';

export type RingtoneStyle = 'BRAUN_CHIME' | 'MARIMBA_PULSE' | 'MINIMAL_BELL';

export type UnlockIntention =
  | 'Reply to DM'
  | 'Planned Break'
  | 'Utility'
  | 'Boredom';

export type LedgerTxType =
  | 'MINT_FOCUS'
  | 'UNLOCK_PASS'
  | 'REFUND_EARLY_LOCK'
  | 'PENALTY_STRICT_ABORT';

export interface BlockedDomainConfig {
  id: string;
  label: string;
  domain: string;
  costPerMin: number;
  category: 'social' | 'video' | 'feed' | 'custom';
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
  createdAt: number;
}

export interface WalletState {
  balance: number; // integer Credits (CR)
  lifetimeMinted: number;
  lastBlockIndex: number;
  lastBlockHash: string;
  updatedAt: number;
}

export interface ActivePass {
  domain: string;
  label: string;
  startedAt: number; // ms epoch
  expiresAt: number; // ms epoch
  costPerMinute: number;
  totalPaid: number;
  intention?: UnlockIntention;
}

export interface PendingSettingsChange {
  newPreset?: PresetId;
  newEarnRatePerMin?: number;
  newBlockedDomains?: BlockedDomainConfig[];
  effectiveAt: number; // ms epoch (24h after request)
}

export interface UserSettings {
  preset: PresetId;
  earnRatePerMin: number; // CR earned per focus minute
  blockedDomains: BlockedDomainConfig[];
  strictLocalAI: boolean;
  soundEnabled: boolean;
  soundVolume: number; // 0..1
  ringtoneStyle: RingtoneStyle;
  pendingChange: PendingSettingsChange | null;
}

export interface ActiveFocusSession {
  isActive: boolean;
  taskLabel: string;
  startedAt: number;
  durationMinutes: number;
  endsAt: number;
  strictStake: boolean;
}

export interface LedgerBlock {
  index: number;
  timestamp: number;
  type: LedgerTxType;
  amount: number; // signed integer CR
  metadata: {
    label: string;
    domain?: string;
    minutes?: number;
    strictStake?: boolean;
    refundedMinutes?: number;
    intention?: UnlockIntention;
    debriefSummary?: string;
  };
  prevHash: string;
  signature: string;
}

export interface CircleMember {
  uid: string;
  displayName: string;
  photoURL: string | null;
  weeklyDaysHit: number;
  weeklyVerifiedMinutes: number;
  isFocusingNow: boolean;
  currentTaskTag: string | null;
  lastPulseAt: number;
}

export interface StudyCircle {
  circleId: string;
  name: string;
  inviteCode: string; // 6-char uppercase
  ownerUid: string;
  memberUids: string[];
  members: CircleMember[];
}

export interface HybridTelemetry {
  lane: 'LOCAL_GEMINI_NANO' | 'CLOUD_GEMINI_3_5_FLASH_LITE' | 'LOCAL_OFFLINE_FALLBACK';
  model: string;
  latencyMs: number;
  privateLocalOnly: boolean;
}

export interface PresetSpec {
  id: PresetId;
  name: string;
  earnRatePerMin: number; // 1.0, 0.75, 0.5
  strictnessRank: number; // 0=CASUAL, 1=STANDARD, 2=MONK
  summary: string;
}

export const PRESET_SPECS: Record<PresetId, PresetSpec> = {
  CASUAL: {
    id: 'CASUAL',
    name: 'Casual',
    earnRatePerMin: 1.0,
    strictnessRank: 0,
    summary: '1 min focus mints 1.0 CR (25m = 25 CR). Balanced daily rate.',
  },
  STANDARD: {
    id: 'STANDARD',
    name: 'Standard',
    earnRatePerMin: 0.75,
    strictnessRank: 1,
    summary: '1 min focus mints 0.75 CR (20m = 15 CR). Structured discipline.',
  },
  MONK: {
    id: 'MONK',
    name: 'Monk',
    earnRatePerMin: 0.5,
    strictnessRank: 2,
    summary: '1 min focus mints 0.5 CR (30m = 15 CR). Strict exam regime.',
  },
};

export const DEFAULT_BLOCKED_DOMAINS: BlockedDomainConfig[] = [
  { id: 'ig', label: 'Instagram', domain: 'instagram.com', costPerMin: 2, category: 'social' },
  { id: 'yt_shorts', label: 'YouTube Shorts', domain: 'youtube.com/shorts', costPerMin: 3, category: 'video' },
  { id: 'tiktok', label: 'TikTok', domain: 'tiktok.com', costPerMin: 3, category: 'video' },
  { id: 'x_reddit', label: 'X / Reddit', domain: 'x.com / reddit.com', costPerMin: 1, category: 'feed' },
];
