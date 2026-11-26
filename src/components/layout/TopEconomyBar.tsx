'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { Settings, Sun, Moon } from 'lucide-react';
import { useChronosStore } from '../../store/useChronosStore';
import { acousticEngine } from '../../lib/audio/acoustic-engine';
import { useMagnetic } from '../../hooks/useMagnetic';

gsap.registerPlugin(Flip);

const NAV_TABS = [
  { href: '/', code: '01', label: 'COMMAND' },
  { href: '/focus', code: '02', label: 'CHAMBER' },
  { href: '/circle', code: '03', label: 'CIRCLE' },
];

export function TopEconomyBar() {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const eqBarsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const flipStateRef = useRef<Flip.FlipState | null>(null);
  const prevPathRef = useRef<string>(pathname);

  const magThemeRef = useMagnetic<HTMLButtonElement>(3);
  const magCreditRef = useMagnetic<HTMLAnchorElement>(3);
  const magAudioRef = useMagnetic<HTMLButtonElement>(3);
  const magSettingsRef = useMagnetic<HTMLButtonElement>(3);

  const profile = useChronosStore((s) => s.profile);
  const userDoc = useChronosStore((s) => s.userDoc);
  const setSettingsOpen = useChronosStore((s) => s.setSettingsOpen);
  const setAuthModalOpen = useChronosStore((s) => s.setAuthModalOpen);
  const focusHeaderRetracted = useChronosStore((s) => s.focusHeaderRetracted);
  const patchSettings = useChronosStore((s) => s.patchSettings);

  const [daylight, setDaylight] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const saved = localStorage.getItem('chronos_theme');
    if (saved === 'daylight') {
      document.documentElement.setAttribute('data-theme', 'daylight');
      setDaylight(true);
    }
  }, []);

  const toggleTheme = () => {
    acousticEngine.playTick();
    const next = !daylight;
    setDaylight(next);
    if (next) {
      document.documentElement.setAttribute('data-theme', 'daylight');
      localStorage.setItem('chronos_theme', 'daylight');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('chronos_theme', 'petrol');
    }
  };

  if (prevPathRef.current !== pathname && navRef.current) {
    const ind = navRef.current.querySelector('[data-flip-id="nav-indicator"]');
    if (ind) flipStateRef.current = Flip.getState(ind);
    prevPathRef.current = pathname;
  }

  useLayoutEffect(() => {
    if (!flipStateRef.current || !navRef.current) return;
    const state = flipStateRef.current;
    flipStateRef.current = null;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      Flip.from(state, { duration: 0.3, ease: 'power3.out' });
    });
    return () => mm.revert();
  }, [pathname]);

  useEffect(() => {
    if (!headerRef.current) return;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.to(headerRef.current, {
        y: focusHeaderRetracted ? -56 : 0,
        opacity: focusHeaderRetracted ? 0 : 1,
        duration: 0.34,
        ease: 'power3.inOut',
        pointerEvents: focusHeaderRetracted ? 'none' : 'auto',
      });
    });
    mm.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set(headerRef.current, {
        y: 0,
        opacity: focusHeaderRetracted ? 0 : 1,
      });
    });
    return () => mm.revert();
  }, [focusHeaderRetracted]);

  const balance = userDoc?.wallet.balance ?? 0;
  const soundEnabled = userDoc?.settings.soundEnabled ?? true;
  const isPassDraining = Boolean(
    userDoc?.activePass && userDoc.activePass.expiresAt > Date.now()
  );

  // Organic GSAP equalizer wave on top bar audio toggle
  useEffect(() => {
    const bars = eqBarsRef.current.filter(Boolean) as HTMLSpanElement[];
    if (bars.length === 0) return;

    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      if (soundEnabled) {
        bars.forEach((bar, idx) => {
          gsap.to(bar, {
            scaleY: 0.35 + ((idx * 0.25) % 0.6),
            duration: 0.42 + idx * 0.14,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            transformOrigin: '50% 100%',
          });
        });
      } else {
        gsap.killTweensOf(bars);
        gsap.to(bars, { scaleY: 0.3, duration: 0.2 });
      }
    });

    return () => {
      gsap.killTweensOf(bars);
      mm.revert();
    };
  }, [soundEnabled]);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 w-full bg-[var(--bg-canvas)] border-b border-[var(--border-hairline)]"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <Link href="/" data-cursor="magnetic" className="flex items-center gap-3 shrink-0 group">
          <svg
            className="w-6 h-6 text-[var(--text-primary)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="9.5" strokeOpacity="0.35" />
            <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
            <circle cx="12" cy="12" r="3" stroke="var(--accent-primary)" />
          </svg>
          <div className="flex items-center gap-2.5">
            <span className="font-mono-num text-xs font-bold tracking-[0.18em] text-[var(--text-primary)]">
              CHRONOS
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 font-mono-num text-[10px] tracking-widest text-[var(--accent-jade)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-jade)] animate-pulse" />
              <span>SYS.OK</span>
            </span>
          </div>
        </Link>

        <nav ref={navRef} className="hidden md:flex items-center h-full gap-6">
          {NAV_TABS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-cursor="magnetic"
                onClick={() => acousticEngine.playTick()}
                className={`relative h-full flex items-center gap-1.5 font-mono-num text-[11px] tracking-[0.12em] transition-colors ${
                  active
                    ? 'text-[var(--text-primary)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <span className="text-[10px] text-[var(--text-tertiary)]">{item.code}</span>
                <span>{item.label}</span>
                {active && (
                  <span
                    data-flip-id="nav-indicator"
                    className="absolute bottom-0 inset-x-0 h-[2px] bg-[var(--accent-primary)]"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            ref={magThemeRef}
            type="button"
            data-cursor="magnetic"
            onClick={toggleTheme}
            title={daylight ? 'Switch to Midnight Petrol' : 'Switch to Paper & Cobalt'}
            className="p-2 rounded-[4px] panel-recessed text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            aria-label="Toggle daylight theme"
          >
            {daylight ? (
              <Moon className="w-3.5 h-3.5" strokeWidth={1.5} />
            ) : (
              <Sun className="w-3.5 h-3.5" strokeWidth={1.5} />
            )}
          </button>

          {profile ? (
            <>
              <Link
                ref={magCreditRef}
                href="/"
                data-cursor="magnetic"
                data-testid="top-credit-pill"
                className="px-2.5 py-1.5 rounded-[4px] panel-recessed font-mono-num text-[11px] font-semibold text-[var(--text-primary)] flex items-center gap-1.5"
              >
                <span
                  data-testid="top-credit-dot"
                  className={`w-1.5 h-1.5 rounded-full ${
                    isPassDraining
                      ? 'bg-[var(--accent-primary)] animate-pulse'
                      : 'bg-[var(--accent-jade)]'
                  }`}
                />
                <span>{balance} CR</span>
              </Link>

              <button
                ref={magAudioRef}
                type="button"
                data-cursor="magnetic"
                onClick={() => patchSettings({ soundEnabled: !soundEnabled })}
                title={soundEnabled ? 'Mute acoustic engine' : 'Enable acoustic engine'}
                className="px-2.5 py-2 rounded-[4px] panel-recessed flex items-end gap-[2px] h-[30px] cursor-pointer"
                aria-label="Toggle audio"
              >
                {[12, 14, 10].map((h, i) => (
                  <span
                    key={i}
                    ref={(el) => {
                      eqBarsRef.current[i] = el;
                    }}
                    className={`w-[2px] ${
                      soundEnabled ? 'bg-[var(--accent-ochre)]' : 'bg-[var(--text-tertiary)]'
                    }`}
                    style={{ height: `${h}px` }}
                  />
                ))}
              </button>

              <button
                ref={magSettingsRef}
                type="button"
                data-cursor="magnetic"
                onClick={() => {
                  acousticEngine.playTick();
                  setSettingsOpen(true);
                }}
                title="System Preferences"
                className="p-2 rounded-[4px] panel-recessed text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                aria-label="Open settings drawer"
              >
                <Settings className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </>
          ) : (
            <button
              type="button"
              data-cursor="magnetic"
              onClick={() => setAuthModalOpen(true)}
              className="px-3.5 py-1.5 rounded-[4px] bg-[var(--accent-primary)] text-white font-mono-num text-[11px] font-semibold tracking-wider uppercase cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      <div className="md:hidden border-t border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-2 flex items-center justify-around">
        {NAV_TABS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`font-mono-num text-[10px] tracking-[0.12em] pb-0.5 ${
                active
                  ? 'text-[var(--text-primary)] border-b-2 border-[var(--accent-primary)] font-semibold'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {item.code} {item.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
