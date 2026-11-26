'use client';

import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Headphones, Pause, Play } from 'lucide-react';
import { acousticEngine } from '../../lib/audio/acoustic-engine';
import { useMagnetic } from '../../hooks/useMagnetic';

interface FocusTimerCanvasProps {
  taskLabel: string;
  durationMinutes: number;
  strictStake: boolean;
  projectedMint: number;
  onCompleteCountdown: () => void;
  onAbandonSession: () => void;
}

export function FocusTimerCanvas({
  taskLabel,
  durationMinutes,
  strictStake,
  projectedMint,
  onCompleteCountdown,
  onAbandonSession,
}: FocusTimerCanvasProps) {
  const totalSeconds = durationMinutes * 60;
  const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds);
  const [paused, setPaused] = useState(false);
  const [pauseUsed, setPauseUsed] = useState(false);
  const [pauseAutoResumeSec, setPauseAutoResumeSec] = useState(180);
  const [brownNoiseOn, setBrownNoiseOn] = useState(() =>
    acousticEngine.isBrownNoisePlaying()
  );
  const [abandonPct, setAbandonPct] = useState(0);
  const [wakeLockActive, setWakeLockActive] = useState(false);

  const ringRef = useRef<SVGCircleElement>(null);
  const sweepHandRef = useRef<SVGLineElement>(null);
  const sweepTweenRef = useRef<gsap.core.Tween | null>(null);
  const noiseBarsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const abandonRingRef = useRef<SVGCircleElement>(null);
  const abandonTlRef = useRef<gsap.core.Timeline | null>(null);
  const magNoiseRef = useMagnetic<HTMLButtonElement>(3);
  const magPauseRef = useMagnetic<HTMLButtonElement>(3);

  const latestRef = useRef({ onCompleteCountdown, onAbandonSession });
  latestRef.current = { onCompleteCountdown, onAbandonSession };

  const radius = 122;
  const circumference = 2 * Math.PI * radius;
  const progress = (totalSeconds - remainingSeconds) / Math.max(1, totalSeconds);
  const dashOffset = circumference * (1 - progress);

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const angle = (i * 6 * Math.PI) / 180;
    const isMajor = i % 5 === 0;
    const rOuter = 144;
    const rInner = isMajor ? 132 : 137;
    return {
      x1: 150 + rInner * Math.sin(angle),
      y1: 150 - rInner * Math.cos(angle),
      x2: 150 + rOuter * Math.sin(angle),
      y2: 150 - rOuter * Math.cos(angle),
      isMajor,
    };
  });

  useEffect(() => {
    const unsub = acousticEngine.onBrownNoiseChange(setBrownNoiseOn);
    return () => {
      unsub();
      acousticEngine.stopBrownNoise();
    };
  }, []);

  useEffect(() => {
    let sentinel: { release: () => Promise<void> } | null = null;
    let active = true;
    async function acquire() {
      try {
        if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
          sentinel = await (
            navigator as unknown as {
              wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> };
            }
          ).wakeLock.request('screen');
          if (active) setWakeLockActive(true);
        }
      } catch {
        // Silent fallback
      }
    }
    acquire();
    return () => {
      active = false;
      sentinel?.release().catch(() => {});
    };
  }, []);

  // Continuous 60-second sweeping Vermilion second-hand around the 60-tick dial
  useEffect(() => {
    const hand = sweepHandRef.current;
    if (!hand) return;

    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      sweepTweenRef.current = gsap.to(hand, {
        rotation: 360,
        duration: 60,
        repeat: -1,
        ease: 'none',
        svgOrigin: '150 150',
      });
    });

    return () => {
      sweepTweenRef.current?.kill();
      mm.revert();
    };
  }, []);

  useEffect(() => {
    if (!sweepTweenRef.current) return;
    if (paused) {
      sweepTweenRef.current.pause();
    } else {
      sweepTweenRef.current.play();
    }
  }, [paused]);

  // Organic GSAP equalizer waves when Brown Noise is ON
  useEffect(() => {
    const bars = noiseBarsRef.current.filter(Boolean) as HTMLSpanElement[];
    if (bars.length === 0) return;

    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      if (brownNoiseOn) {
        bars.forEach((bar, idx) => {
          gsap.to(bar, {
            scaleY: 0.3 + ((idx * 0.22) % 0.65),
            duration: 0.36 + idx * 0.12,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            transformOrigin: '50% 100%',
          });
        });
      } else {
        gsap.killTweensOf(bars);
      }
    });

    return () => {
      gsap.killTweensOf(bars);
      mm.revert();
    };
  }, [brownNoiseOn]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setTimeout(() => latestRef.current.onCompleteCountdown(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [paused]);

  useEffect(() => {
    if (!paused) return;
    const id = setInterval(() => {
      setPauseAutoResumeSec((prev) => {
        if (prev <= 1) {
          setPaused(false);
          acousticEngine.playTick();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [paused]);

  useEffect(() => {
    if (!ringRef.current) return;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.to(ringRef.current, {
        strokeDashoffset: dashOffset,
        duration: 0.45,
        ease: 'power1.out',
      });
    });
    mm.add('(prefers-reduced-motion: reduce)', () => {
      if (ringRef.current) ringRef.current.style.strokeDashoffset = String(dashOffset);
    });
    return () => mm.revert();
  }, [dashOffset]);

  const abandonRadius = 9;
  const abandonCirc = 2 * Math.PI * abandonRadius;

  const getAbandonTl = () => {
    if (abandonTlRef.current) return abandonTlRef.current;
    const proxy = { p: 0 };
    const tl = gsap.timeline({
      paused: true,
      onComplete: () => {
        acousticEngine.stopBrownNoise();
        latestRef.current.onAbandonSession();
      },
    });
    tl.to(proxy, {
      p: 1,
      duration: 1.5,
      ease: 'none',
      onUpdate: () => {
        setAbandonPct(Math.round(proxy.p * 100));
        if (abandonRingRef.current) {
          abandonRingRef.current.style.strokeDashoffset = String(
            abandonCirc * (1 - proxy.p)
          );
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('chronos-hold-progress', { detail: { progress: proxy.p } })
          );
        }
      },
      onReverseComplete: () => {
        setAbandonPct(0);
        if (abandonRingRef.current) {
          abandonRingRef.current.style.strokeDashoffset = String(abandonCirc);
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('chronos-hold-progress', { detail: { progress: 0 } })
          );
        }
      },
    });
    abandonTlRef.current = tl;
    return tl;
  };

  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const pMin = Math.floor(pauseAutoResumeSec / 60);
  const pSec = pauseAutoResumeSec % 60;

  return (
    <div className="min-h-[78vh] flex items-center justify-center">
      <div
        data-flip-id="chamber-shell"
        className="w-full max-w-2xl panel-surface rounded-[4px] p-8 sm:p-10 flex flex-col items-center text-center space-y-8"
      >
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 font-mono-num text-[10px] uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                paused ? 'bg-[var(--accent-ochre)]' : 'bg-[var(--accent-jade)] animate-pulse'
              }`}
            />
            <span>{paused ? 'EMERGENCY PAUSE ACTIVE' : 'CHAMBER SEALED'}</span>
            {wakeLockActive && <span>// WAKE LOCKED</span>}
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{taskLabel}</h1>
        </div>

        {/* 60-Tick Precision Watch Dial SVG + Sweeping Vermilion Sub-Second Hand */}
        <div className="relative w-[300px] h-[300px] flex items-center justify-center">
          <svg className="w-[300px] h-[300px]" viewBox="0 0 300 300">
            <circle
              cx="150"
              cy="150"
              r="146"
              stroke="var(--border-hairline)"
              strokeWidth="1"
              fill="none"
            />
            {ticks.map((t, i) => (
              <line
                key={i}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke="var(--text-primary)"
                strokeOpacity={t.isMajor ? 0.55 : 0.16}
                strokeWidth={t.isMajor ? 1.5 : 1}
              />
            ))}

            {/* Sweeping Vermilion Sub-Second Indicator Hand */}
            <line
              ref={sweepHandRef}
              x1="150"
              y1="26"
              x2="150"
              y2="8"
              stroke="var(--accent-primary)"
              strokeWidth="2"
            />

            <circle
              cx="150"
              cy="150"
              r={radius}
              stroke="var(--border-hairline)"
              strokeWidth="2"
              fill="none"
            />
            <circle
              ref={ringRef}
              cx="150"
              cy="150"
              r={radius}
              stroke="var(--accent-primary)"
              strokeWidth="3"
              strokeDasharray={circumference}
              strokeDashoffset={circumference}
              fill="none"
              transform="rotate(-90 150 150)"
            />
          </svg>

          <div className="absolute flex flex-col items-center">
            <span
              data-testid="countdown-display"
              className="font-mono-num text-[64px] leading-none font-bold text-[var(--text-primary)] tracking-[-0.04em] tabular-nums"
            >
              {mins < 10 ? `0${mins}` : mins}:{secs < 10 ? `0${secs}` : secs}
            </span>
            <span className="font-mono-num text-[11px] uppercase tracking-[0.14em] text-[var(--accent-jade)] mt-3 font-semibold">
              +{projectedMint} CR ACCRUING
              {strictStake ? ' · STRICT' : ''}
            </span>
            {paused && (
              <span className="font-mono-num text-[11px] text-[var(--accent-ochre)] mt-1.5">
                AUTO-RESUMES IN {pMin}:{pSec < 10 ? `0${pSec}` : pSec}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 w-full pt-2">
          <button
            ref={magNoiseRef}
            type="button"
            data-cursor="magnetic"
            onClick={() => acousticEngine.toggleBrownNoise()}
            className={`px-4 py-3 rounded-[4px] border font-mono-num text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              brownNoiseOn
                ? 'border-[var(--accent-ochre)] bg-[var(--accent-ochre)]/12 text-[var(--accent-ochre)]'
                : 'panel-recessed text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Headphones className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>{brownNoiseOn ? 'Brown Noise: ON' : 'Brown Noise: OFF'}</span>
            {brownNoiseOn && (
              <span className="inline-flex items-end gap-[2px] h-3 ml-1">
                {[8, 12, 9, 13].map((h, idx) => (
                  <span
                    key={idx}
                    ref={(el) => {
                      noiseBarsRef.current[idx] = el;
                    }}
                    className="w-[2px] bg-[var(--accent-ochre)]"
                    style={{ height: `${h}px` }}
                  />
                ))}
              </span>
            )}
          </button>

          {paused ? (
            <button
              ref={magPauseRef}
              type="button"
              data-cursor="magnetic"
              onClick={() => {
                acousticEngine.playTick();
                setPaused(false);
              }}
              className="px-5 py-3 rounded-[4px] bg-[var(--accent-ochre)] text-[#0A0E14] font-mono-num text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5 fill-current" strokeWidth={1.5} />
              <span>Resume Focus</span>
            </button>
          ) : (
            <button
              ref={magPauseRef}
              type="button"
              data-cursor={pauseUsed ? undefined : 'magnetic'}
              disabled={pauseUsed}
              onClick={() => {
                acousticEngine.playTick();
                setPauseUsed(true);
                setPauseAutoResumeSec(180);
                setPaused(true);
              }}
              className={`px-4 py-3 rounded-[4px] border font-mono-num text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors whitespace-nowrap ${
                pauseUsed
                  ? 'panel-recessed text-[var(--text-tertiary)] cursor-not-allowed'
                  : 'panel-recessed text-[var(--text-primary)] hover:border-[var(--accent-ochre)] cursor-pointer'
              }`}
            >
              <Pause className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>{pauseUsed ? 'Pause (0 Left)' : 'Pause (1 Left)'}</span>
            </button>
          )}

          <button
            type="button"
            data-cursor="hold"
            onPointerDown={() => getAbandonTl().play()}
            onPointerUp={() => {
              if (abandonTlRef.current && abandonTlRef.current.progress() < 1) {
                abandonTlRef.current.reverse();
              }
            }}
            onPointerLeave={() => {
              if (abandonTlRef.current && abandonTlRef.current.progress() < 1) {
                abandonTlRef.current.reverse();
              }
            }}
            onPointerCancel={() => {
              if (abandonTlRef.current && abandonTlRef.current.progress() < 1) {
                abandonTlRef.current.reverse();
              }
            }}
            className="min-w-[190px] px-4 py-3 rounded-[4px] panel-recessed border border-[var(--accent-primary)]/50 hover:bg-[var(--accent-primary)]/10 font-mono-num text-[11px] font-semibold uppercase tracking-wider text-[var(--accent-primary)] flex items-center justify-center gap-2 select-none touch-none cursor-pointer whitespace-nowrap"
          >
            <svg className="w-5 h-5 -rotate-90 shrink-0" viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="12"
                r={abandonRadius}
                stroke="var(--border-hairline)"
                strokeWidth="2"
                fill="none"
              />
              <circle
                ref={abandonRingRef}
                cx="12"
                cy="12"
                r={abandonRadius}
                stroke="var(--accent-primary)"
                strokeWidth="2"
                strokeDasharray={abandonCirc}
                strokeDashoffset={abandonCirc}
                fill="none"
              />
            </svg>
            <span>
              {abandonPct > 0 ? `Abandoning (${abandonPct}%)` : 'Hold 1.5s to Abandon'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
