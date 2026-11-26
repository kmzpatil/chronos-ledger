'use client';

import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Lock, X, Volume2, CheckCircle2 } from 'lucide-react';
import { useChronosStore } from '../store/useChronosStore';

export function AcousticToastPill() {
  const acousticAlerts = useChronosStore((s) => s.acousticAlerts);
  const dismissAcousticAlert = useChronosStore((s) => s.dismissAcousticAlert);
  const lockEarlyAndRefund = useChronosStore((s) => s.lockEarlyAndRefund);

  return (
    <div className="fixed top-16 right-4 z-[85] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-auto pointer-events-none">
      <AnimatePresence>
        {acousticAlerts.map((alert) => {
          const isWarn = alert.kind === 'warning';
          const isExpired = alert.kind === 'expired';
          const accent = isWarn
            ? 'var(--accent-ochre)'
            : isExpired
            ? 'var(--accent-primary)'
            : 'var(--accent-jade)';

          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto panel-elevated rounded-[4px] px-4 py-3 flex items-center gap-3.5"
              style={{ borderLeft: `3px solid ${accent}` }}
            >
              <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-[4px] panel-recessed">
                {alert.kind === 'complete' ? (
                  <CheckCircle2 className="w-4 h-4 text-[var(--accent-jade)]" strokeWidth={1.5} />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none">
                    {[
                      { x: 2, delay: '0s', h: 10 },
                      { x: 6, delay: '0.12s', h: 14 },
                      { x: 10, delay: '0.24s', h: 8 },
                      { x: 14, delay: '0.08s', h: 16 },
                      { x: 18, delay: '0.18s', h: 9 },
                    ].map((bar, idx) => (
                      <rect
                        key={idx}
                        x={bar.x - 1}
                        y={(20 - bar.h) / 2}
                        width="2"
                        height={bar.h}
                        fill={accent}
                      >
                        <animate
                          attributeName="height"
                          values={`4;${bar.h};6;${Math.max(4, bar.h - 4)};4`}
                          dur="0.9s"
                          begin={bar.delay}
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="y"
                          values={`8;${(20 - bar.h) / 2};7;${(20 - Math.max(4, bar.h - 4)) / 2};8`}
                          dur="0.9s"
                          begin={bar.delay}
                          repeatCount="indefinite"
                        />
                      </rect>
                    ))}
                  </svg>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 font-mono-num text-[11px] font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                  <Volume2 className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0" strokeWidth={1.5} />
                  <span className="truncate">{alert.title}</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] leading-snug mt-0.5">
                  {alert.subtitle}
                </p>

                {alert.canLockEarly && (
                  <button
                    onClick={async () => {
                      await lockEarlyAndRefund();
                      dismissAcousticAlert(alert.id);
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] border border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[10px] font-mono-num font-semibold uppercase tracking-wider text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20 transition-colors cursor-pointer"
                  >
                    <Lock className="w-3 h-3" strokeWidth={1.5} />
                    <span>Lock Now &amp; Refund</span>
                  </button>
                )}
              </div>

              <button
                onClick={() => dismissAcousticAlert(alert.id)}
                className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
                aria-label="Dismiss acoustic notification"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
