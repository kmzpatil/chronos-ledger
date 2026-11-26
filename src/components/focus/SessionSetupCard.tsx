'use client';

import React from 'react';
import * as Switch from '@radix-ui/react-switch';
import { Lock } from 'lucide-react';
import { acousticEngine } from '../../lib/audio/acoustic-engine';

const DURATIONS = [15, 25, 45, 60];
const QUICK_DOMAINS = [
  'Systems Architecture',
  'Compiler Passes',
  'Linear Algebra',
  'Research Writing',
];

interface SessionSetupCardProps {
  durationMinutes: number;
  setDurationMinutes: (m: number) => void;
  taskLabel: string;
  setTaskLabel: (t: string) => void;
  strictStake: boolean;
  setStrictStake: (v: boolean) => void;
  earnRatePerMin: number;
  onStart: () => void;
}

export function SessionSetupCard({
  durationMinutes,
  setDurationMinutes,
  taskLabel,
  setTaskLabel,
  strictStake,
  setStrictStake,
  earnRatePerMin,
  onStart,
}: SessionSetupCardProps) {
  const projectedMint = Math.round(
    durationMinutes * earnRatePerMin * (strictStake ? 1.2 : 1.0)
  );

  return (
    <div className="max-w-lg mx-auto panel-surface rounded-[4px] p-7 space-y-6">
      <div className="space-y-1 pb-4 border-b border-[var(--border-hairline)]">
        <div className="font-mono-num text-[10px] uppercase tracking-[0.16em] text-[var(--accent-primary)]">
          02 // HOROLOGICAL CHAMBER CALIBRATION
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Configure <span className="font-serif-accent italic font-normal">Focus</span> Block
        </h1>
      </div>

      {/* Tactile Mechanical Radio Switches */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between font-mono-num text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
          <span>DURATION BLOCK</span>
          <span>RATE: {earnRatePerMin}X</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {DURATIONS.map((m) => {
            const active = durationMinutes === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  acousticEngine.playTick();
                  setDurationMinutes(m);
                }}
                className={`py-3 rounded-[4px] font-mono-num text-xs font-semibold border transition-colors cursor-pointer ${
                  active
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/12 text-[var(--text-primary)]'
                    : 'panel-recessed text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {m}M
              </button>
            );
          })}
        </div>
      </div>

      {/* Clean Underline Task Input */}
      <div className="space-y-2.5">
        <label className="block font-mono-num text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
          FOCUS DOMAIN
        </label>
        <input
          type="text"
          value={taskLabel}
          onChange={(e) => setTaskLabel(e.target.value)}
          placeholder="What are you building or studying?"
          className="w-full py-2.5 bg-transparent border-b border-[var(--border-hairline)] text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
        />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {QUICK_DOMAINS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => {
                acousticEngine.playTick();
                setTaskLabel(chip);
              }}
              className={`px-2.5 py-1 rounded-[2px] font-mono-num text-[10px] uppercase tracking-wider border transition-colors cursor-pointer ${
                taskLabel === chip
                  ? 'border-[var(--accent-primary)] text-[var(--text-primary)] bg-[var(--accent-primary)]/10'
                  : 'panel-recessed text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Strict Stake Toggle */}
      <div className="p-4 rounded-[4px] panel-recessed flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="font-mono-num text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
            Strict Stake Mode
          </div>
          <p className="font-mono-num text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
            +20% CR BONUS / -10 CR ABORT PENALTY
          </p>
        </div>
        <Switch.Root
          checked={strictStake}
          onCheckedChange={(v) => {
            acousticEngine.playTick();
            setStrictStake(v);
          }}
          className="w-10 h-6 rounded-[4px] panel-surface border border-[var(--border-hairline)] data-[state=checked]:bg-[var(--accent-primary)] relative transition-colors cursor-pointer shrink-0"
        >
          <Switch.Thumb className="block w-4 h-4 bg-[var(--text-primary)] data-[state=checked]:bg-white rounded-[2px] transition-transform translate-x-1 data-[state=checked]:translate-x-5" />
        </Switch.Root>
      </div>

      {/* Projected Mint Readout */}
      <div className="p-4 rounded-[4px] panel-recessed flex items-center justify-between font-mono-num text-xs">
        <span className="text-[var(--text-secondary)] uppercase tracking-wider text-[11px]">
          PROJECTED MINT
        </span>
        <span className="text-base font-bold text-[var(--accent-jade)]">
          +{projectedMint} CR
        </span>
      </div>

      {/* Full-Width Vermilion CTA */}
      <button
        type="button"
        data-cursor="magnetic"
        onClick={() => {
          acousticEngine.playVaultEngage(1);
          onStart();
        }}
        className="w-full py-4 px-5 rounded-[4px] bg-[var(--accent-primary)] hover:opacity-90 text-white font-mono-num font-semibold text-xs uppercase tracking-[0.14em] flex items-center justify-center gap-2 transition-opacity cursor-pointer"
      >
        <Lock className="w-3.5 h-3.5" strokeWidth={2} />
        <span>SEAL CHAMBER &amp; START</span>
      </button>
    </div>
  );
}
