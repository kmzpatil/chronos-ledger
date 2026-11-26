'use client';

import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { ActivePass, BlockedDomainConfig } from '../../types/chronos';
import { acousticEngine } from '../../lib/audio/acoustic-engine';

interface ShieldsCardProps {
  domains: BlockedDomainConfig[];
  activePass: ActivePass | null;
  onUnlockClick: (dom: BlockedDomainConfig) => void;
  onLockEarly: () => void;
  onAddDomain: (
    label: string,
    domain: string,
    costPerMin: number
  ) => Promise<{ ok: boolean; message: string }>;
}

export function ShieldsCard({
  domains,
  activePass,
  onUnlockClick,
  onLockEarly,
  onAddDomain,
}: ShieldsCardProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [labelInput, setLabelInput] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [rateInput, setRateInput] = useState(2);
  const [addErr, setAddErr] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddErr(null);
    const res = await onAddDomain(labelInput, domainInput, rateInput);
    if (!res.ok) {
      setAddErr(res.message);
      return;
    }
    setLabelInput('');
    setDomainInput('');
    setRateInput(2);
    setPopoverOpen(false);
  };

  const countStr = String(domains.length).padStart(2, '0');

  return (
    <section data-animate-panel className="panel-surface rounded-[4px] flex flex-col">
      <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between gap-3 relative">
        <div className="font-mono-num text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)]">
          DISTRACTION SHIELDS [{countStr} ACTIVE]
        </div>

        <button
          type="button"
          data-cursor="magnetic"
          onClick={() => {
            acousticEngine.playTick();
            setPopoverOpen((p) => !p);
          }}
          className="px-3 py-1.5 rounded-[4px] panel-recessed hover:border-[var(--accent-primary)] font-mono-num text-[10px] uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
        >
          {popoverOpen ? (
            <X className="w-3 h-3" strokeWidth={1.5} />
          ) : (
            <Plus className="w-3 h-3 text-[var(--accent-primary)]" strokeWidth={1.5} />
          )}
          <span>Add Domain</span>
        </button>

        {popoverOpen && (
          <form
            onSubmit={handleAdd}
            className="absolute right-4 top-12 z-30 w-72 panel-elevated rounded-[4px] p-4 space-y-3"
          >
            <div className="font-mono-num text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
              Shield Custom URL
            </div>
            <input
              type="text"
              required
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder="Label (e.g. Twitch)"
              className="w-full px-3 py-2 rounded-[4px] panel-recessed text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
            <input
              type="text"
              required
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="Domain (e.g. twitch.tv)"
              className="w-full px-3 py-2 rounded-[4px] panel-recessed font-mono-num text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
            <div className="flex items-center justify-between font-mono-num text-xs">
              <span className="text-[var(--text-secondary)]">Burn Rate:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRateInput((r) => Math.max(1, r - 1))}
                  className="w-6 h-6 rounded-[4px] panel-recessed text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  -
                </button>
                <span className="text-[var(--accent-primary)] font-semibold w-14 text-center">
                  {rateInput} CR/M
                </span>
                <button
                  type="button"
                  onClick={() => setRateInput((r) => Math.min(10, r + 1))}
                  className="w-6 h-6 rounded-[4px] panel-recessed text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
            {addErr && (
              <p className="text-[11px] text-[var(--accent-primary)] font-mono-num">{addErr}</p>
            )}
            <button
              type="submit"
              data-cursor="magnetic"
              className="w-full py-2 rounded-[4px] bg-[var(--accent-primary)] text-white font-mono-num text-[11px] font-semibold uppercase tracking-wider cursor-pointer"
            >
              Add to Shields
            </button>
          </form>
        )}
      </div>

      <div>
        {domains.map((dom) => {
          const isUnlocked = activePass?.domain === dom.domain;
          return (
            <div
              key={dom.id}
              data-flip-id={`shield-${dom.id}`}
              className={`group relative overflow-hidden h-[60px] px-5 border-b last:border-b-0 border-[var(--border-hairline)] flex items-center justify-between gap-4 transition-colors ${
                isUnlocked ? 'stripe-drain' : 'hover:bg-white/[0.02]'
              }`}
            >
              {/* Subtle diagonal hairline sheen on hover */}
              {!isUnlocked && (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background:
                      'linear-gradient(120deg, transparent 35%, rgba(18, 184, 134, 0.04) 50%, transparent 65%)',
                  }}
                />
              )}

              <div className="relative z-10 flex items-center gap-3.5 min-w-0">
                <span
                  className={`font-mono-num text-[10px] font-semibold uppercase tracking-wider shrink-0 transition-transform duration-200 ${
                    isUnlocked
                      ? 'text-[var(--accent-primary)]'
                      : 'text-[var(--accent-jade)] group-hover:scale-105'
                  }`}
                >
                  {isUnlocked ? '◐ UNLOCKED' : '● LOCKED'}
                </span>

                <div className="flex items-baseline gap-2 min-w-0 transition-transform duration-200 ease-out group-hover:translate-x-1">
                  <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {dom.label}
                  </span>
                  <span className="hidden sm:inline font-mono-num text-[11px] text-[var(--text-tertiary)] truncate">
                    {dom.domain}
                  </span>
                </div>
              </div>

              <div className="relative z-10 flex items-center gap-4 shrink-0">
                <span className="font-mono-num text-[11px] text-[var(--text-secondary)]">
                  {dom.costPerMin} CR/MIN
                </span>

                {isUnlocked ? (
                  <button
                    type="button"
                    data-cursor="magnetic"
                    onClick={onLockEarly}
                    className="px-4 py-2 rounded-[4px] bg-[var(--bg-canvas)] border border-[var(--accent-primary)] font-mono-num text-[11px] font-semibold uppercase tracking-wider text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
                  >
                    Lock Early
                  </button>
                ) : (
                  <button
                    type="button"
                    data-cursor={activePass ? undefined : 'hold'}
                    disabled={Boolean(activePass)}
                    onClick={() => onUnlockClick(dom)}
                    className={`px-4 py-2 rounded-[4px] border font-mono-num text-[11px] font-medium uppercase tracking-wider transition-colors whitespace-nowrap ${
                      activePass
                        ? 'panel-recessed text-[var(--text-tertiary)] cursor-not-allowed'
                        : 'panel-recessed hover:border-[var(--accent-primary)] text-[var(--text-primary)] cursor-pointer'
                    }`}
                  >
                    Unlock Pass
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
