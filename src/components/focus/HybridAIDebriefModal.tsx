'use client';

import React, { useState } from 'react';
import { Cpu, CheckCircle2 } from 'lucide-react';
import { runHybridDebrief } from '../../lib/ai/hybrid-router';
import { HybridTelemetry } from '../../types/chronos';

interface HybridAIDebriefModalProps {
  taskLabel: string;
  durationMinutes: number;
  strictStake: boolean;
  projectedMint: number;
  strictLocalAI: boolean;
  onVerifiedMint: (
    summary: string,
    aiFeedback: string,
    telemetry: HybridTelemetry
  ) => Promise<void>;
}

export function HybridAIDebriefModal({
  taskLabel,
  durationMinutes,
  projectedMint,
  strictLocalAI,
  onVerifiedMint,
}: HybridAIDebriefModalProps) {
  const [summary, setSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerifyAndMint = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = summary.trim();
    if (trimmed.length < 15) {
      setError('Write at least two clear sentences summarizing what you accomplished.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await runHybridDebrief(
        `Verify 2-sentence deep work summary for "${taskLabel}" (${durationMinutes}m): "${trimmed}". Give 1 concise validation sentence.`,
        { taskLabel, strictLocalAI }
      );
      await onVerifiedMint(trimmed, res.text, res.telemetry);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to verify session debrief.');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto panel-surface rounded-[4px] p-7 space-y-5">
      <div className="flex items-start justify-between pb-4 border-b border-[var(--border-hairline)]">
        <div>
          <span className="font-mono-num text-[10px] uppercase tracking-[0.16em] text-[var(--accent-jade)]">
            ON-DEVICE PROOF OF WORK
          </span>
          <h2 className="text-xl font-bold text-[var(--text-primary)] mt-0.5">
            Gemini Nano Accomplishment Debrief
          </h2>
        </div>
        <span className="font-mono-num text-[11px] font-semibold px-2.5 py-1 rounded-[2px] border border-[var(--accent-jade)]/40 text-[var(--accent-jade)] bg-[var(--accent-jade)]/10">
          +{projectedMint} CR
        </span>
      </div>

      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
        Your {durationMinutes}-minute chamber for{' '}
        <strong className="text-[var(--text-primary)]">{taskLabel}</strong> is complete. Write a brief 2-sentence summary verified on-device via Chrome Gemini Nano to mint credits.
      </p>

      <form onSubmit={handleVerifyAndMint} className="space-y-4">
        <textarea
          rows={4}
          required
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Example: Implemented lock-free ring buffer tests and verified wrap-around boundaries. Fixed two alignment warnings."
          className="w-full px-3.5 py-3 rounded-[4px] panel-recessed text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
        />

        {error && <p className="text-xs font-mono-num text-[var(--accent-primary)]">{error}</p>}

        <div className="flex items-center justify-between font-mono-num text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-[var(--accent-primary)]" strokeWidth={1.5} />
            <span>
              {strictLocalAI
                ? 'GEMINI NANO // STRICT LOCAL MODE'
                : 'GEMINI NANO → FIREBASE AI LOGIC'}
            </span>
          </span>
          <span>{summary.trim().length} CHARS</span>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 px-5 rounded-[4px] bg-[var(--accent-jade)] hover:opacity-90 text-[#0A0E14] font-mono-num font-bold text-xs uppercase tracking-[0.14em] flex items-center justify-center gap-2 transition-opacity cursor-pointer"
        >
          {submitting ? (
            <span>VERIFYING &amp; SIGNING HMAC BLOCK...</span>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
              <span>VERIFY SUMMARY &amp; MINT +{projectedMint} CR</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
