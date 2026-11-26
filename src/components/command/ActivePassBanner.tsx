'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';
import { ActivePass } from '../../types/chronos';

interface ActivePassBannerProps {
  activePass: ActivePass;
  now: number;
  onLockEarly: () => void;
}

export function ActivePassBanner({
  activePass,
  now,
  onLockEarly,
}: ActivePassBannerProps) {
  const remainingMs = Math.max(0, activePass.expiresAt - now);
  const remainingSecTotal = Math.floor(remainingMs / 1000);
  const remMins = Math.floor(remainingSecTotal / 60);
  const remSecs = remainingSecTotal % 60;
  const unusedWholeMins = Math.floor(remainingMs / 60000);
  const refundableCR = Math.min(
    activePass.totalPaid,
    unusedWholeMins * activePass.costPerMinute
  );

  return (
    <div
      data-flip-id="active-pass-banner"
      className="rounded-[4px] px-5 py-4 stripe-drain border border-[var(--accent-primary)] bg-[var(--bg-panel)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
    >
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="inline-flex items-center gap-1.5 font-mono-num text-[10px] uppercase tracking-[0.14em] text-[var(--accent-primary)] font-semibold">
            <span>◐ UNLOCKED</span>
          </span>
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {activePass.label}
          </span>
          <span className="font-mono-num text-[10px] text-[var(--text-secondary)]">
            // {activePass.domain}
          </span>
          {activePass.intention && (
            <span className="font-mono-num text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[2px] panel-recessed text-[var(--text-secondary)]">
              {activePass.intention}
            </span>
          )}
        </div>
        <div className="font-mono-num text-[11px] text-[var(--text-secondary)]">
          ACTIVE DRAIN · {activePass.costPerMinute} CR/MIN · PAID {activePass.totalPaid} CR
        </div>
      </div>

      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end shrink-0">
        <div className="font-mono-num text-[28px] leading-none font-bold text-[var(--text-primary)] tabular-nums">
          {remMins < 10 ? `0${remMins}` : remMins}:{remSecs < 10 ? `0${remSecs}` : remSecs}
        </div>

        <button
          type="button"
          data-cursor="magnetic"
          onClick={onLockEarly}
          className="px-4 py-2.5 rounded-[4px] bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)] border border-[var(--accent-primary)] font-mono-num text-[11px] font-semibold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[var(--accent-primary)]" strokeWidth={1.5} />
          <span>LOCK NOW &amp; REFUND +{refundableCR} CR</span>
        </button>
      </div>
    </div>
  );
}
