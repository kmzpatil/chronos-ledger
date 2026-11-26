'use client';

import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Slider from '@radix-ui/react-slider';
import * as Switch from '@radix-ui/react-switch';
import * as Tabs from '@radix-ui/react-tabs';
import { AnimatePresence, motion } from 'motion/react';
import {
  Volume2,
  X,
  Hourglass,
  Cpu,
  Shield,
  LogOut,
  UserCheck,
  BellRing,
  Trash2,
  Download,
} from 'lucide-react';
import { useChronosStore } from '../../store/useChronosStore';
import { PRESET_SPECS, PresetId, RingtoneStyle } from '../../types/chronos';
import { acousticEngine } from '../../lib/audio/acoustic-engine';

const RINGTONE_STYLES: { id: RingtoneStyle; name: string; desc: string }[] = [
  { id: 'BRAUN_CHIME', name: 'Braun Chime', desc: 'Warm Fmaj7 triangle arpeggio (default)' },
  { id: 'MARIMBA_PULSE', name: 'Marimba Pulse', desc: 'Rhythmic desktop clock interval' },
  { id: 'MINIMAL_BELL', name: 'Minimal Bell', desc: 'High-register sine harmonic chime' },
];

export function SettingsDrawer() {
  const isSettingsOpen = useChronosStore((s) => s.isSettingsOpen);
  const setSettingsOpen = useChronosStore((s) => s.setSettingsOpen);
  const profile = useChronosStore((s) => s.profile);
  const userDoc = useChronosStore((s) => s.userDoc);
  const patchSettings = useChronosStore((s) => s.patchSettings);
  const removeBlockedDomain = useChronosStore((s) => s.removeBlockedDomain);
  const exportLedgerJson = useChronosStore((s) => s.exportLedgerJson);
  const upgradeGoogle = useChronosStore((s) => s.upgradeGoogle);
  const upgradeEmail = useChronosStore((s) => s.upgradeEmail);
  const logout = useChronosStore((s) => s.logout);
  const setAuthModalOpen = useChronosStore((s) => s.setAuthModalOpen);

  const [activeTab, setActiveTab] = useState<'economy' | 'audio'>('economy');
  const [feedback, setFeedback] = useState<{ msg: string; cooldown?: boolean } | null>(null);
  const [upgradeEmailVal, setUpgradeEmailVal] = useState('');
  const [upgradePassVal, setUpgradePassVal] = useState('');
  const [upgradeBusy, setUpgradeBusy] = useState(false);

  const settings = userDoc?.settings;
  if (!settings) {
    return (
      <Dialog.Root open={isSettingsOpen} onOpenChange={setSettingsOpen}>
        <AnimatePresence>
          {isSettingsOpen && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75" />
              <Dialog.Content className="fixed right-0 top-0 bottom-0 z-[60] w-full max-w-md panel-elevated p-6 border-l border-[var(--border-hairline)] flex flex-col justify-between">
                <div className="flex items-center justify-between pb-4 border-b border-[var(--border-hairline)]">
                  <Dialog.Title className="font-mono-num text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
                    System Preferences
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button className="p-1.5 rounded-[4px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">
                      <X className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </Dialog.Close>
                </div>
                <div className="py-12 text-center space-y-4">
                  <p className="text-xs text-[var(--text-secondary)]">
                    Sign in or continue as guest to customize rules and ringtones.
                  </p>
                  <button
                    onClick={() => {
                      setSettingsOpen(false);
                      setAuthModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-[4px] bg-[var(--accent-primary)] text-white font-mono-num text-xs font-semibold uppercase tracking-wider cursor-pointer"
                  >
                    Open Sign In
                  </button>
                </div>
                <div />
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>
    );
  }

  const showToast = (msg: string, cooldown?: boolean) => {
    setFeedback({ msg, cooldown });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleSelectPreset = async (id: PresetId) => {
    const res = await patchSettings({
      preset: id,
      earnRatePerMin: PRESET_SPECS[id].earnRatePerMin,
    });
    showToast(res.message, res.cooldownScheduled);
  };

  const handleDomainCostStep = async (id: string, delta: number) => {
    const updated = settings.blockedDomains.map((d) =>
      d.id === id ? { ...d, costPerMin: Math.max(1, Math.min(10, d.costPerMin + delta)) } : d
    );
    const res = await patchSettings({ blockedDomains: updated });
    showToast(res.message, res.cooldownScheduled);
  };

  const handleDeleteDomain = async (id: string) => {
    const res = await removeBlockedDomain(id);
    showToast(res.message, res.cooldownScheduled);
  };

  const handleUpgradeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upgradeEmailVal || !upgradePassVal) return;
    setUpgradeBusy(true);
    try {
      await upgradeEmail(upgradeEmailVal, upgradePassVal);
      showToast('Guest wallet & streak linked cleanly to your account.');
      setUpgradeEmailVal('');
      setUpgradePassVal('');
    } catch {
      showToast('Could not link account. Check credentials.', true);
    } finally {
      setUpgradeBusy(false);
    }
  };

  const pendingHours = settings.pendingChange
    ? Math.max(1, Math.ceil((settings.pendingChange.effectiveAt - Date.now()) / 3600000))
    : 0;

  return (
    <Dialog.Root open={isSettingsOpen} onOpenChange={setSettingsOpen}>
      <AnimatePresence>
        {isSettingsOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-50 bg-black/70"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.aside
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="fixed right-0 top-0 bottom-0 z-[60] w-full max-w-md panel-elevated border-l border-[var(--border-hairline)] flex flex-col focus:outline-none"
              >
                <div className="px-6 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between shrink-0">
                  <div>
                    <Dialog.Title className="font-mono-num text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)]">
                      System Preferences
                    </Dialog.Title>
                    <Dialog.Description className="font-mono-num text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mt-0.5">
                      Economy // Acoustic Synth // Identity
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      className="p-1.5 rounded-[4px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      aria-label="Close settings"
                    >
                      <X className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </Dialog.Close>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                  <Tabs.Root
                    value={activeTab}
                    onValueChange={(v) => {
                      acousticEngine.playTick();
                      setActiveTab(v as 'economy' | 'audio');
                    }}
                  >
                    <Tabs.List className="grid grid-cols-2 p-1 rounded-[4px] panel-recessed">
                      <Tabs.Trigger
                        value="economy"
                        className={`py-2 rounded-[2px] font-mono-num text-[11px] uppercase tracking-wider transition-colors cursor-pointer ${
                          activeTab === 'economy'
                            ? 'bg-[var(--bg-panel)] text-[var(--text-primary)] font-semibold'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        Economy &amp; Shields
                      </Tabs.Trigger>
                      <Tabs.Trigger
                        value="audio"
                        className={`py-2 rounded-[2px] font-mono-num text-[11px] uppercase tracking-wider transition-colors cursor-pointer ${
                          activeTab === 'audio'
                            ? 'bg-[var(--bg-panel)] text-[var(--text-primary)] font-semibold'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        Audio &amp; Account
                      </Tabs.Trigger>
                    </Tabs.List>

                    {feedback && (
                      <div
                        className={`mt-4 p-3 rounded-[4px] border font-mono-num text-xs ${
                          feedback.cooldown
                            ? 'border-[var(--accent-ochre)] bg-[var(--accent-ochre)]/10 text-[var(--accent-ochre)]'
                            : 'border-[var(--accent-jade)] bg-[var(--accent-jade)]/10 text-[var(--accent-jade)]'
                        }`}
                      >
                        {feedback.msg}
                      </div>
                    )}

                    {/* TAB 1: ECONOMY & SHIELDS */}
                    <Tabs.Content value="economy" className="mt-5 space-y-6 focus:outline-none">
                      {settings.pendingChange && (
                        <div className="p-3.5 rounded-[4px] border border-[var(--accent-ochre)] bg-[var(--accent-ochre)]/10 flex items-start gap-2.5 text-xs text-[var(--accent-ochre)]">
                          <Hourglass className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
                          <div>
                            <div className="font-mono-num font-semibold uppercase tracking-wider text-[11px]">
                              24-Hour Anti-Cheat Cooldown
                            </div>
                            <p className="font-mono-num text-[10px] text-[var(--text-secondary)] mt-0.5">
                              Loosened settings take effect in ~{pendingHours}h. Tightening strictness applies immediately.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2.5">
                        <label className="block font-mono-num text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                          Economy Presets
                        </label>
                        <div className="space-y-2">
                          {(['CASUAL', 'STANDARD', 'MONK'] as PresetId[]).map((pid) => {
                            const spec = PRESET_SPECS[pid];
                            const active = settings.preset === pid;
                            return (
                              <button
                                key={pid}
                                type="button"
                                onClick={() => handleSelectPreset(pid)}
                                className={`w-full p-3.5 rounded-[4px] border text-left transition-colors cursor-pointer ${
                                  active
                                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                                    : 'panel-recessed text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-mono-num text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
                                    {spec.name}
                                  </span>
                                  <span className="font-mono-num text-[11px] font-semibold text-[var(--accent-primary)]">
                                    {spec.earnRatePerMin}X CR/M
                                  </span>
                                </div>
                                <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                                  {spec.summary}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-2.5 pt-2 border-t border-[var(--border-hairline)]">
                        <div className="flex items-center gap-1.5 font-mono-num text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                          <Shield className="w-3.5 h-3.5 text-[var(--accent-jade)]" strokeWidth={1.5} />
                          <span>Blocked Domains &amp; Rates</span>
                        </div>
                        <div className="space-y-2">
                          {settings.blockedDomains.map((d) => (
                            <div
                              key={d.id}
                              className="p-3 rounded-[4px] panel-recessed flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0">
                                <div className="font-medium text-[var(--text-primary)] truncate">
                                  {d.label}
                                </div>
                                <div className="font-mono-num text-[10px] text-[var(--text-secondary)] truncate">
                                  {d.domain}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 font-mono-num shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleDomainCostStep(d.id, -1)}
                                  className="w-6 h-6 rounded-[2px] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                                >
                                  -
                                </button>
                                <span className="w-11 text-center text-[var(--accent-primary)] font-semibold">
                                  {d.costPerMin} CR
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDomainCostStep(d.id, 1)}
                                  className="w-6 h-6 rounded-[2px] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                                >
                                  +
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDomain(d.id)}
                                  title="Delete blocked domain (24h cooldown)"
                                  className="p-1.5 rounded-[2px] text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] cursor-pointer ml-1"
                                  aria-label={`Remove ${d.label}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-4 rounded-[4px] panel-recessed flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-mono-num text-[11px] font-semibold uppercase tracking-wider text-[var(--text-primary)]">
                            <Cpu className="w-3.5 h-3.5 text-[var(--accent-jade)]" strokeWidth={1.5} />
                            <span>Strict Local-Only AI</span>
                          </div>
                          <p className="text-[11px] text-[var(--text-secondary)]">
                            On-device Chrome Gemini Nano (window.ai) with zero cloud API keys.
                          </p>
                        </div>
                        <Switch.Root
                          checked={settings.strictLocalAI}
                          onCheckedChange={async (checked) => {
                            await patchSettings({ strictLocalAI: checked });
                            showToast(
                              checked
                                ? 'On-Device Gemini Nano strict lock enabled.'
                                : 'On-Device Gemini Nano with local deterministic fallback.'
                            );
                          }}
                          className="w-10 h-6 rounded-[4px] panel-surface border border-[var(--border-hairline)] data-[state=checked]:bg-[var(--accent-jade)] relative transition-colors cursor-pointer shrink-0"
                        >
                          <Switch.Thumb className="block w-4 h-4 bg-[var(--text-primary)] data-[state=checked]:bg-white rounded-[2px] transition-transform translate-x-1 data-[state=checked]:translate-x-5" />
                        </Switch.Root>
                      </div>
                    </Tabs.Content>

                    {/* TAB 2: AUDIO & ACCOUNT */}
                    <Tabs.Content value="audio" className="mt-5 space-y-6 focus:outline-none">
                      <div className="space-y-4">
                        <div className="p-4 rounded-[4px] panel-recessed flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <Volume2 className="w-4 h-4 text-[var(--accent-ochre)]" strokeWidth={1.5} />
                            <div>
                              <div className="font-mono-num text-[11px] font-semibold uppercase tracking-wider text-[var(--text-primary)]">
                                Acoustic Engine
                              </div>
                              <div className="text-[11px] text-[var(--text-secondary)]">
                                Web Audio polyphonic chimes
                              </div>
                            </div>
                          </div>
                          <Switch.Root
                            checked={settings.soundEnabled}
                            onCheckedChange={async (checked) => {
                              await patchSettings({ soundEnabled: checked });
                            }}
                            className="w-10 h-6 rounded-[4px] panel-surface border border-[var(--border-hairline)] data-[state=checked]:bg-[var(--accent-primary)] relative transition-colors cursor-pointer"
                          >
                            <Switch.Thumb className="block w-4 h-4 bg-[var(--text-primary)] data-[state=checked]:bg-white rounded-[2px] transition-transform translate-x-1 data-[state=checked]:translate-x-5" />
                          </Switch.Root>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between font-mono-num text-[11px]">
                            <span className="text-[var(--text-secondary)]">MASTER GAIN</span>
                            <span className="text-[var(--text-primary)] font-semibold">
                              {Math.round(settings.soundVolume * 100)}%
                            </span>
                          </div>
                          <Slider.Root
                            className="relative flex items-center select-none touch-none w-full h-5"
                            value={[settings.soundVolume]}
                            min={0.1}
                            max={1}
                            step={0.05}
                            onValueCommit={async ([val]) => {
                              await patchSettings({ soundVolume: val });
                              acousticEngine.playTick();
                            }}
                          >
                            <Slider.Track className="panel-recessed relative grow rounded-[2px] h-1.5">
                              <Slider.Range className="absolute bg-[var(--accent-primary)] rounded-[2px] h-full" />
                            </Slider.Track>
                            <Slider.Thumb className="block w-3.5 h-3.5 bg-[var(--text-primary)] border border-[var(--accent-primary)] rounded-[2px] cursor-grab" />
                          </Slider.Root>
                        </div>

                        <div className="space-y-2">
                          <label className="block font-mono-num text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                            Ringtone Style
                          </label>
                          {RINGTONE_STYLES.map((style) => {
                            const selected = settings.ringtoneStyle === style.id;
                            return (
                              <button
                                key={style.id}
                                type="button"
                                onClick={async () => {
                                  await patchSettings({ ringtoneStyle: style.id });
                                  acousticEngine.playPassWarningRingtone({
                                    overrideStyle: style.id,
                                    domainLabel: 'Preview',
                                  });
                                }}
                                className={`w-full p-3 rounded-[4px] border text-left transition-colors cursor-pointer ${
                                  selected
                                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                                    : 'panel-recessed text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                              >
                                <div className="flex items-center justify-between font-mono-num text-xs font-medium">
                                  <span>{style.name}</span>
                                  {selected && (
                                    <span className="text-[10px] text-[var(--accent-primary)]">
                                      ACTIVE
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                                  {style.desc}
                                </p>
                              </button>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            acousticEngine.playPassWarningRingtone({ domainLabel: 'Instagram' })
                          }
                          className="w-full py-2.5 px-4 rounded-[4px] bg-[var(--accent-primary)] text-white font-mono-num font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <BellRing className="w-3.5 h-3.5" strokeWidth={1.5} />
                          <span>Test 2m Warning Ringtone</span>
                        </button>
                      </div>

                      <div className="pt-4 border-t border-[var(--border-hairline)] space-y-3.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono-num text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                            Account &amp; Export
                          </span>
                          <span className="font-mono-num text-[10px] px-2 py-0.5 rounded-[2px] border border-[var(--border-hairline)] text-[var(--text-primary)]">
                            {profile?.isAnonymous ? 'GUEST' : 'VERIFIED'}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-[4px] panel-recessed space-y-1 text-xs">
                          <div className="font-semibold text-[var(--text-primary)]">
                            {profile?.displayName}
                          </div>
                          <div className="font-mono-num text-[11px] text-[var(--text-secondary)]">
                            {profile?.email || 'Local Anonymous UID'}
                          </div>
                        </div>

                        {profile?.isAnonymous && (
                          <div className="p-4 rounded-[4px] border border-[var(--accent-primary)]/50 bg-[var(--accent-primary)]/5 space-y-3">
                            <div className="flex items-center gap-2 font-mono-num text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-primary)]">
                              <UserCheck className="w-4 h-4" strokeWidth={1.5} />
                              <span>Upgrade Guest (linkWithPopup)</span>
                            </div>

                            <button
                              type="button"
                              onClick={upgradeGoogle}
                              className="w-full py-2 px-3 rounded-[4px] bg-[var(--bg-vault-paper)] text-[var(--ink-vault)] font-mono-num text-xs font-semibold uppercase tracking-wider cursor-pointer hover:opacity-90"
                            >
                              Link Google Account
                            </button>

                            <form
                              onSubmit={handleUpgradeEmail}
                              className="space-y-2 pt-2 border-t border-[var(--border-hairline)]"
                            >
                              <input
                                type="email"
                                required
                                value={upgradeEmailVal}
                                onChange={(e) => setUpgradeEmailVal(e.target.value)}
                                placeholder="Email"
                                className="w-full px-3 py-2 rounded-[4px] panel-recessed text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
                              />
                              <input
                                type="password"
                                required
                                minLength={6}
                                value={upgradePassVal}
                                onChange={(e) => setUpgradePassVal(e.target.value)}
                                placeholder="Password (6+ chars)"
                                className="w-full px-3 py-2 rounded-[4px] panel-recessed text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
                              />
                              <button
                                type="submit"
                                disabled={upgradeBusy}
                                className="w-full py-2 rounded-[4px] border border-[var(--accent-primary)] font-mono-num text-xs font-semibold uppercase tracking-wider text-[var(--accent-primary)] cursor-pointer"
                              >
                                {upgradeBusy ? 'Linking...' : 'Upgrade with Email'}
                              </button>
                            </form>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={exportLedgerJson}
                          className="w-full py-2.5 rounded-[4px] panel-recessed hover:border-[var(--accent-primary)] font-mono-num text-xs uppercase tracking-wider text-[var(--text-primary)] flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-[var(--accent-primary)]" strokeWidth={1.5} />
                          <span>Export JSON Ledger</span>
                        </button>

                        <button
                          type="button"
                          onClick={logout}
                          className="w-full py-2.5 rounded-[4px] panel-recessed hover:border-[var(--accent-primary)] font-mono-num text-xs uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--accent-primary)] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
                          <span>Sign Out &amp; Clear</span>
                        </button>
                      </div>
                    </Tabs.Content>
                  </Tabs.Root>
                </div>
              </motion.aside>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
