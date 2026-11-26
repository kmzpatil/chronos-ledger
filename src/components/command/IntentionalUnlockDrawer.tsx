'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { Lock, ShieldAlert, X } from 'lucide-react';
import { useChronosStore } from '../../store/useChronosStore';
import { UnlockIntention } from '../../types/chronos';
import { acousticEngine } from '../../lib/audio/acoustic-engine';

gsap.registerPlugin(CustomEase);

const DURATIONS = [10, 15, 30];
const INTENTIONS: UnlockIntention[] = [
  'Reply to DM',
  'Planned Break',
  'Utility',
  'Boredom',
];

export function IntentionalUnlockDrawer() {
  const unlockTarget = useChronosStore((s) => s.unlockTarget);
  const setUnlockTarget = useChronosStore((s) => s.setUnlockTarget);
  const userDoc = useChronosStore((s) => s.userDoc);
  const buyPass = useChronosStore((s) => s.buyPass);

  const [minutes, setMinutes] = useState<number>(15);
  const [intention, setIntention] = useState<UnlockIntention | null>(null);
  const [holdPct, setHoldPct] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isHolding, setIsHolding] = useState(false);

  const innerVibrationRef = useRef<HTMLDivElement>(null);
  const drainFillRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const holdTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const lastTickStepRef = useRef<number>(-1);

  const latestRef = useRef({ unlockTarget, minutes, intention, buyPass, setUnlockTarget });
  latestRef.current = { unlockTarget, minutes, intention, buyPass, setUnlockTarget };

  const balance = userDoc?.wallet.balance ?? 0;
  const earnRate = userDoc?.settings.earnRatePerMin ?? 1.0;
  const totalCost = unlockTarget ? minutes * unlockTarget.costPerMin : 0;
  const focusMinutesEquivalent = Math.round(totalCost / Math.max(0.25, earnRate));
  const canAfford = balance >= totalCost;
  const readyToHold = canAfford && intention !== null;

  const ringRadius = 18;
  const ringCircumference = 2 * Math.PI * ringRadius;

  useEffect(() => {
    setErrorMsg(null);
    setHoldPct(0);
    setIsHolding(false);
    setIntention(null);
    if (holdTimelineRef.current) {
      holdTimelineRef.current.kill();
      holdTimelineRef.current = null;
    }
  }, [unlockTarget]);

  useEffect(() => {
    setHoldPct(0);
    setIsHolding(false);
    if (holdTimelineRef.current) {
      holdTimelineRef.current.kill();
      holdTimelineRef.current = null;
    }
  }, [minutes, intention]);

  const getOrCreateTimeline = () => {
    if (holdTimelineRef.current) return holdTimelineRef.current;

    try {
      CustomEase.create('vaultTension', '0.65, 0.05, 0.36, 1');
    } catch {
      // ignore if registered
    }

    const proxy = { p: 0 };
    const tl = gsap.timeline({
      paused: true,
      onComplete: async () => {
        setIsHolding(false);
        const {
          unlockTarget: target,
          minutes: mins,
          intention: chosenIntent,
          buyPass: doBuy,
          setUnlockTarget: closeDrawer,
        } = latestRef.current;
        if (!target || !chosenIntent) return;

        const res = await doBuy(target, mins, chosenIntent);
        if (res.ok) {
          closeDrawer(null);
        } else {
          setErrorMsg(res.error || 'Unable to unlock pass.');
          tl.progress(0).pause();
          setHoldPct(0);
        }
      },
    });

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    tl.to(proxy, {
      p: 1,
      duration: 2.0,
      ease: 'vaultTension',
      onUpdate: () => {
        const p = proxy.p;
        setHoldPct(Math.round(p * 100));

        if (ringRef.current) {
          ringRef.current.style.strokeDashoffset = String(ringCircumference * (1 - p));
        }

        if (drainFillRef.current) {
          drainFillRef.current.style.width = `${(p * 100).toFixed(1)}%`;
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('chronos-hold-progress', { detail: { progress: p } })
          );
        }

        const step = Math.floor(p * 5);
        if (step > lastTickStepRef.current && step > 0 && step < 5) {
          lastTickStepRef.current = step;
          acousticEngine.playTick();
        }

        if (!reduceMotion && innerVibrationRef.current) {
          if (p >= 0.8 && p < 0.995) {
            const jitter = Math.sin(p * 180) * 0.85;
            innerVibrationRef.current.style.transform = `translateX(${jitter.toFixed(2)}px)`;
          } else {
            innerVibrationRef.current.style.transform = 'translateX(0px)';
          }
        }
      },
      onReverseComplete: () => {
        lastTickStepRef.current = -1;
        setHoldPct(0);
        if (ringRef.current) ringRef.current.style.strokeDashoffset = String(ringCircumference);
        if (drainFillRef.current) drainFillRef.current.style.width = '0%';
        if (innerVibrationRef.current) innerVibrationRef.current.style.transform = 'translateX(0px)';
      },
    });

    holdTimelineRef.current = tl;
    return tl;
  };

  const handlePointerDown = () => {
    if (!readyToHold) return;
    setErrorMsg(null);
    setIsHolding(true);
    lastTickStepRef.current = -1;
    getOrCreateTimeline().play();
  };

  const handlePointerRelease = () => {
    setIsHolding(false);
    const tl = holdTimelineRef.current;
    if (tl && tl.progress() < 1) {
      tl.reverse();
    }
  };

  return (
    <Dialog.Root
      open={!!unlockTarget}
      onOpenChange={(open) => {
        if (!open) {
          holdTimelineRef.current?.kill();
          holdTimelineRef.current = null;
          setUnlockTarget(null);
        }
      }}
    >
      <AnimatePresence>
        {unlockTarget && (
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
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-[calc(100%-2rem)] max-w-md panel-elevated rounded-[4px] p-6 focus:outline-none"
              >
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]">
                  <div>
                    <Dialog.Title className="text-base font-semibold text-[var(--text-primary)]">
                      Intentional Vault Unlock
                    </Dialog.Title>
                    <Dialog.Description className="font-mono-num text-[11px] uppercase tracking-wider text-[var(--text-secondary)] mt-0.5">
                      {unlockTarget.label} // {unlockTarget.domain}
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      className="p-1.5 rounded-[4px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      aria-label="Close unlock drawer"
                    >
                      <X className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </Dialog.Close>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between font-mono-num text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                    <span>01 // PASS DURATION</span>
                    <span>{unlockTarget.costPerMin} CR / MIN</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {DURATIONS.map((d) => {
                      const active = minutes === d;
                      const cost = d * unlockTarget.costPerMin;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            acousticEngine.playTick();
                            setMinutes(d);
                          }}
                          className={`p-3 rounded-[4px] border text-left transition-colors cursor-pointer ${
                            active
                              ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                              : 'panel-recessed text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <div className="font-mono-num text-sm font-bold">{d}M</div>
                          <div className="font-mono-num text-[11px] text-[var(--accent-primary)]">
                            {cost} CR
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <label className="block font-mono-num text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                    02 // DECLARE INTENTION (REQUIRED)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {INTENTIONS.map((tag) => {
                      const active = intention === tag;
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            acousticEngine.playTick();
                            setIntention(tag);
                          }}
                          className={`px-3 py-2 rounded-[4px] border text-xs font-medium text-left transition-colors cursor-pointer ${
                            active
                              ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-primary)]'
                              : 'panel-recessed text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 p-3.5 rounded-[4px] panel-recessed space-y-1.5 font-mono-num text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">OPPORTUNITY COST</span>
                    <span className="text-[var(--accent-primary)] font-semibold">
                      {totalCost} CR ({focusMinutesEquivalent}M FOCUS)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">POST-DEBIT BALANCE</span>
                    <span className={canAfford ? 'text-[var(--accent-jade)]' : 'text-[var(--accent-primary)]'}>
                      {canAfford ? `${balance - totalCost} CR` : `SHORT ${totalCost - balance} CR`}
                    </span>
                  </div>
                </div>

                {errorMsg && (
                  <div className="mt-3 p-3 rounded-[4px] border border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-xs text-[var(--accent-primary)] flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* 2.0s Press-and-Hold Diagonal Stripe Fill Button */}
                <div className="mt-5">
                  <button
                    type="button"
                    data-cursor={readyToHold ? 'hold' : undefined}
                    disabled={!readyToHold}
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerRelease}
                    onPointerLeave={handlePointerRelease}
                    onPointerCancel={handlePointerRelease}
                    className={`relative overflow-hidden w-full py-3.5 px-4 rounded-[4px] border select-none touch-none transition-colors ${
                      readyToHold
                        ? 'panel-recessed border-[var(--accent-primary)] text-[var(--text-primary)] cursor-pointer'
                        : 'panel-recessed border-[var(--border-hairline)] text-[var(--text-tertiary)] cursor-not-allowed'
                    }`}
                  >
                    {/* Diagonal stripe fill meter */}
                    <div
                      ref={drainFillRef}
                      className="absolute inset-y-0 left-0 w-0 stripe-drain pointer-events-none"
                    />

                    <div
                      ref={innerVibrationRef}
                      className="relative z-10 flex items-center justify-center gap-3 pointer-events-none"
                    >
                      <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 44 44">
                          <circle
                            cx="22"
                            cy="22"
                            r={ringRadius}
                            stroke="var(--border-hairline)"
                            strokeWidth="2"
                            fill="none"
                          />
                          <circle
                            ref={ringRef}
                            cx="22"
                            cy="22"
                            r={ringRadius}
                            stroke="var(--accent-primary)"
                            strokeWidth="2.5"
                            strokeDasharray={ringCircumference}
                            strokeDashoffset={ringCircumference}
                            fill="none"
                          />
                        </svg>
                        <Lock
                          className={`w-3.5 h-3.5 absolute ${
                            isHolding ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'
                          }`}
                          strokeWidth={1.5}
                        />
                      </div>

                      <div className="text-left">
                        <div className="font-mono-num text-xs font-semibold uppercase tracking-wider">
                          {!canAfford
                            ? 'INSUFFICIENT CREDITS'
                            : !intention
                            ? 'SELECT INTENTION FIRST'
                            : isHolding
                            ? `AUTHORIZING PASS (${holdPct}%)`
                            : 'HOLD 2.0s TO UNLOCK'}
                        </div>
                        <div className="font-mono-num text-[10px] text-[var(--text-secondary)]">
                          Pro-rata refund available if locked early
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
