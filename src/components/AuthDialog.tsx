'use client';

import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import { AnimatePresence, motion } from 'motion/react';
import { Lock, X, ShieldCheck, ArrowRight } from 'lucide-react';
import { useChronosStore } from '../store/useChronosStore';

export function AuthDialog() {
  const isAuthModalOpen = useChronosStore((s) => s.isAuthModalOpen);
  const setAuthModalOpen = useChronosStore((s) => s.setAuthModalOpen);
  const loginGoogle = useChronosStore((s) => s.loginGoogle);
  const loginEmail = useChronosStore((s) => s.loginEmail);
  const signupEmail = useChronosStore((s) => s.signupEmail);
  const loginGuest = useChronosStore((s) => s.loginGuest);

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        await loginEmail(email, password);
      } else {
        await signupEmail(email, password, name);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={isAuthModalOpen} onOpenChange={setAuthModalOpen}>
      <AnimatePresence>
        {isAuthModalOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-50 bg-black/75"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-[calc(100%-2rem)] max-w-md panel-elevated rounded-[4px] p-6 focus:outline-none"
              >
                <div className="flex items-start justify-between pb-4 border-b border-[var(--border-hairline)]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-[4px] panel-recessed flex items-center justify-center text-[var(--accent-primary)]">
                      <ShieldCheck className="w-4 h-4" strokeWidth={1.5} />
                    </div>
                    <div>
                      <Dialog.Title className="text-sm font-semibold text-[var(--text-primary)]">
                        Chronos Session Vault
                      </Dialog.Title>
                      <Dialog.Description className="text-[10px] font-mono-num uppercase tracking-wider text-[var(--text-secondary)]">
                        Firebase Auth // HTTP-Only SSR Session
                      </Dialog.Description>
                    </div>
                  </div>

                  <Dialog.Close asChild>
                    <button
                      className="p-1 rounded-[4px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      aria-label="Close auth modal"
                    >
                      <X className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </Dialog.Close>
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await loginGoogle();
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="py-2.5 px-4 rounded-[4px] bg-[var(--bg-vault-paper)] text-[var(--ink-vault)] font-mono-num font-semibold text-[11px] uppercase tracking-wider transition-opacity hover:opacity-90 cursor-pointer"
                  >
                    Google OAuth
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await loginGuest();
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="py-2.5 px-4 rounded-[4px] bg-[var(--accent-primary)] text-white font-mono-num font-semibold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90 cursor-pointer"
                  >
                    <span>Continue as Guest</span>
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                </div>

                <div className="my-5 flex items-center gap-3">
                  <div className="flex-1 h-[1px] bg-[var(--border-hairline)]" />
                  <span className="font-mono-num text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">
                    Email Credentials
                  </span>
                  <div className="flex-1 h-[1px] bg-[var(--border-hairline)]" />
                </div>

                <Tabs.Root value={mode} onValueChange={(v) => setMode(v as 'signin' | 'signup')}>
                  <Tabs.List className="grid grid-cols-2 p-1 rounded-[4px] panel-recessed mb-4">
                    <Tabs.Trigger
                      value="signin"
                      className={`py-1.5 rounded-[2px] font-mono-num text-[11px] uppercase tracking-wider cursor-pointer ${
                        mode === 'signin'
                          ? 'bg-[var(--bg-panel)] text-[var(--text-primary)] font-semibold'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      Sign In
                    </Tabs.Trigger>
                    <Tabs.Trigger
                      value="signup"
                      className={`py-1.5 rounded-[2px] font-mono-num text-[11px] uppercase tracking-wider cursor-pointer ${
                        mode === 'signup'
                          ? 'bg-[var(--bg-panel)] text-[var(--text-primary)] font-semibold'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      Register
                    </Tabs.Trigger>
                  </Tabs.List>

                  <form onSubmit={handleSubmit} className="space-y-3">
                    {mode === 'signup' && (
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Display Name"
                        className="w-full px-3.5 py-2.5 rounded-[4px] panel-recessed text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
                      />
                    )}
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email address"
                      className="w-full px-3.5 py-2.5 rounded-[4px] panel-recessed text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password (min 6 chars)"
                      className="w-full px-3.5 py-2.5 rounded-[4px] panel-recessed text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />

                    {error && <p className="text-xs text-[var(--accent-primary)] font-mono-num">{error}</p>}

                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full py-2.5 rounded-[4px] bg-[var(--accent-primary)] text-white font-mono-num font-semibold text-[11px] uppercase tracking-wider cursor-pointer"
                    >
                      {busy
                        ? 'Authenticating...'
                        : mode === 'signin'
                        ? 'Sign In to Ledger'
                        : 'Initialize Ledger'}
                    </button>
                  </form>
                </Tabs.Root>

                <div className="mt-4 pt-3 border-t border-[var(--border-hairline)] flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                  <Lock className="w-3.5 h-3.5 text-[var(--accent-jade)] shrink-0" strokeWidth={1.5} />
                  <span>Guest progress migrates seamlessly on upgrade.</span>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
