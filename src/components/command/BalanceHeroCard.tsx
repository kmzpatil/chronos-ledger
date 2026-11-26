'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ArrowRight } from 'lucide-react';
import { AnimatedCreditCounter } from '../AnimatedCreditCounter';
import { BlockedDomainConfig, PresetId, WalletState } from '../../types/chronos';
import { acousticEngine } from '../../lib/audio/acoustic-engine';
import { useMagnetic } from '../../hooks/useMagnetic';

interface BalanceHeroCardProps {
  wallet: WalletState;
  blockedDomains: BlockedDomainConfig[];
  preset: PresetId;
  earnRatePerMin: number;
  ledgerValid: boolean;
}

export function BalanceHeroCard({
  wallet,
  blockedDomains,
  preset,
  earnRatePerMin,
  ledgerValid,
}: BalanceHeroCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const specRef = useRef<HTMLDivElement>(null);
  const ctaMagRef = useMagnetic<HTMLAnchorElement>(4);

  useEffect(() => {
    const card = cardRef.current;
    const spec = specRef.current;
    if (!card || !spec || typeof window === 'undefined') return;
    if (
      window.matchMedia('(pointer: coarse)').matches ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const pos = { x: 50, y: 50 };
    const xTo = gsap.quickTo(pos, 'x', {
      duration: 0.45,
      ease: 'power3.out',
      onUpdate: () => {
        spec.style.background = `radial-gradient(380px circle at ${pos.x}% ${pos.y}%, rgba(255, 255, 255, 0.08), transparent 70%)`;
      },
    });
    const yTo = gsap.quickTo(pos, 'y', {
      duration: 0.45,
      ease: 'power3.out',
    });

    const onMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 100;
      const py = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100;
      gsap.to(spec, { opacity: 1, duration: 0.25 });
      xTo(px);
      yTo(py);
    };

    const onLeave = () => {
      gsap.to(spec, { opacity: 0, duration: 0.35 });
    };

    card.addEventListener('mousemove', onMove);
    card.addEventListener('mouseleave', onLeave);
    return () => {
      card.removeEventListener('mousemove', onMove);
      card.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  const conversions = blockedDomains.slice(0, 2).map((d) => {
    const mins = Math.floor(wallet.balance / Math.max(1, d.costPerMin));
    return `= ${mins}m ${d.label}`;
  });

  return (
    <section
      ref={cardRef}
      data-animate-panel
      className="relative overflow-hidden vault-guilloche rounded-[4px] border border-[var(--border-vault)] p-6 space-y-6"
    >
      {/* Pointer-driven brushed paper specular highlight */}
      <div
        ref={specRef}
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-0"
      />

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-current/15">
        <span className="font-mono-num text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">
          BEARER TIME-CREDIT BALANCE
        </span>

        <span
          className={`font-mono-num text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-0.5 rounded-[2px] border ${
            ledgerValid
              ? 'border-[#12B886]/50 text-[#12B886] bg-[#12B886]/10'
              : 'border-[#FF4D2D]/50 text-[#FF4D2D] bg-[#FF4D2D]/10'
          }`}
        >
          {ledgerValid ? 'HMAC-SHA256 VERIFIED' : 'CHAIN ALERT'}
        </span>
      </div>

      <div className="relative z-10 space-y-3">
        <AnimatedCreditCounter
          value={wallet.balance}
          className="text-[72px] leading-none font-bold tracking-[-0.04em]"
          suffixClassName="opacity-75"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 font-mono-num text-[11px] opacity-80">
          <div className="flex items-center gap-3 flex-wrap">
            {conversions.map((c, idx) => (
              <span key={idx}>{c}</span>
            ))}
          </div>
          <span>
            LIFETIME: <strong>{wallet.lifetimeMinted} CR</strong> · {preset} ({earnRatePerMin}X)
          </span>
        </div>
      </div>

      <Link
        ref={ctaMagRef}
        href="/focus"
        data-cursor="magnetic"
        onClick={() => acousticEngine.playTick()}
        className="relative z-10 w-full py-3.5 px-5 rounded-[4px] bg-[var(--ink-vault)] text-[var(--bg-vault-paper)] font-mono-num text-xs font-semibold uppercase tracking-[0.14em] flex items-center justify-between transition-opacity hover:opacity-90"
      >
        <span>ENTER FOCUS CHAMBER</span>
        <ArrowRight className="w-4 h-4 text-[var(--accent-primary)]" strokeWidth={2} />
      </Link>
    </section>
  );
}
