'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { Cpu, AlertTriangle } from 'lucide-react';
import { useChronosStore } from '../../store/useChronosStore';
import { HybridTelemetry } from '../../types/chronos';
import { acousticEngine } from '../../lib/audio/acoustic-engine';
import { SessionSetupCard } from '../../components/focus/SessionSetupCard';
import { FocusTimerCanvas } from '../../components/focus/FocusTimerCanvas';
import { HybridAIDebriefModal } from '../../components/focus/HybridAIDebriefModal';

gsap.registerPlugin(Flip);

type FocusFSMStage = 'IDLE' | 'SEALED' | 'DEBRIEF' | 'MINTED' | 'ABANDONED';

export default function FocusChamberPage() {
  const userDoc = useChronosStore((s) => s.userDoc);
  const setFocusHeaderRetracted = useChronosStore((s) => s.setFocusHeaderRetracted);
  const setFocusSession = useChronosStore((s) => s.setFocusSession);
  const mintSessionCredits = useChronosStore((s) => s.mintSessionCredits);
  const applyAbandonPenalty = useChronosStore((s) => s.applyAbandonPenalty);

  const [stage, setStage] = useState<FocusFSMStage>('IDLE');
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [taskLabel, setTaskLabel] = useState('Systems Architecture');
  const [strictStake, setStrictStake] = useState(false);

  const [mintedAmount, setMintedAmount] = useState(0);
  const [mintTxHash, setMintTxHash] = useState('');
  const [debriefFeedback, setDebriefFeedback] = useState('');
  const [debriefTelemetry, setDebriefTelemetry] = useState<HybridTelemetry | null>(null);
  const [penaltyCR, setPenaltyCR] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const flipStateRef = useRef<Flip.FlipState | null>(null);

  const earnRatePerMin = userDoc?.settings.earnRatePerMin ?? 1.0;
  const projectedMint = Math.round(
    durationMinutes * earnRatePerMin * (strictStake ? 1.2 : 1.0)
  );

  useEffect(() => {
    setFocusHeaderRetracted(stage === 'SEALED');
    return () => setFocusHeaderRetracted(false);
  }, [stage, setFocusHeaderRetracted]);

  useLayoutEffect(() => {
    if (!flipStateRef.current) return;
    const state = flipStateRef.current;
    flipStateRef.current = null;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      Flip.from(state, {
        duration: 0.42,
        ease: 'power3.inOut',
      });
    });
    return () => mm.revert();
  }, [stage]);

  const handleStartChamber = async () => {
    if (rootRef.current) {
      const shell = rootRef.current.querySelector('[data-flip-id="chamber-shell"]');
      if (shell) flipStateRef.current = Flip.getState(shell);
    }
    const now = Date.now();
    setStage('SEALED');
    await setFocusSession({
      isActive: true,
      taskLabel,
      startedAt: now,
      durationMinutes,
      endsAt: now + durationMinutes * 60000,
      strictStake,
    });
  };

  const handleCountdownComplete = () => {
    acousticEngine.stopBrownNoise();
    acousticEngine.playFocusCompleteChime(projectedMint);
    setStage('DEBRIEF');
  };

  const handleAbandon = async () => {
    await setFocusSession(null);
    if (strictStake) {
      const burned = await applyAbandonPenalty(taskLabel);
      setPenaltyCR(burned);
      setStage('ABANDONED');
    } else {
      setStage('IDLE');
    }
  };

  const handleVerifiedMint = async (
    summary: string,
    aiFeedback: string,
    telemetry: HybridTelemetry
  ) => {
    const { mintedCR, txHash } = await mintSessionCredits(
      durationMinutes,
      taskLabel,
      strictStake,
      summary
    );
    setMintedAmount(mintedCR);
    setMintTxHash(txHash);
    setDebriefFeedback(aiFeedback);
    setDebriefTelemetry(telemetry);
    setStage('MINTED');
  };

  return (
    <div ref={rootRef} className="py-4">
      {stage === 'IDLE' && (
        <div data-flip-id="chamber-shell">
          <SessionSetupCard
            durationMinutes={durationMinutes}
            setDurationMinutes={setDurationMinutes}
            taskLabel={taskLabel}
            setTaskLabel={setTaskLabel}
            strictStake={strictStake}
            setStrictStake={setStrictStake}
            earnRatePerMin={earnRatePerMin}
            onStart={handleStartChamber}
          />
        </div>
      )}

      {stage === 'SEALED' && (
        <FocusTimerCanvas
          taskLabel={taskLabel}
          durationMinutes={durationMinutes}
          strictStake={strictStake}
          projectedMint={projectedMint}
          onCompleteCountdown={handleCountdownComplete}
          onAbandonSession={handleAbandon}
        />
      )}

      {stage === 'DEBRIEF' && (
        <HybridAIDebriefModal
          taskLabel={taskLabel}
          durationMinutes={durationMinutes}
          strictStake={strictStake}
          projectedMint={projectedMint}
          strictLocalAI={userDoc?.settings.strictLocalAI ?? false}
          onVerifiedMint={handleVerifiedMint}
        />
      )}

      {stage === 'MINTED' && (
        <div className="max-w-lg mx-auto vault-guilloche rounded-[4px] border border-[var(--border-vault)] p-7 space-y-6">
          <div className="flex items-start justify-between pb-4 border-b border-current/15">
            <div>
              <div className="font-mono-num text-[10px] uppercase tracking-[0.16em] opacity-70">
                SWISS TIME-LEDGER DEPOSIT SLIP
              </div>
              <h2 className="text-2xl font-bold mt-1">
                Credits <span className="font-serif-accent italic font-normal">Minted</span>
              </h2>
            </div>
            <div className="px-2.5 py-1 rounded-[2px] border border-[#12B886] text-[#12B886] font-mono-num text-[10px] font-bold uppercase tracking-widest">
              SIGNED // +{mintedAmount} CR
            </div>
          </div>

          <div className="space-y-2 font-mono-num text-xs">
            <div className="flex justify-between">
              <span className="opacity-70">DOMAIN</span>
              <span className="font-semibold">{taskLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">DURATION</span>
              <span className="font-semibold">{durationMinutes} MIN</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-70">BLOCK SIGNATURE</span>
              <span className="font-semibold">{mintTxHash.slice(0, 16)}...</span>
            </div>
          </div>

          <p className="text-xs leading-relaxed p-4 rounded-[4px] border border-current/15 bg-current/[0.04]">
            {debriefFeedback}
          </p>

          {debriefTelemetry && (
            <div className="flex items-center gap-2 font-mono-num text-[10px] uppercase tracking-wider opacity-75">
              <Cpu className="w-3.5 h-3.5 text-[var(--accent-primary)]" strokeWidth={1.5} />
              <span>VERIFIED BY {debriefTelemetry.model}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              data-cursor="magnetic"
              onClick={() => setStage('IDLE')}
              className="py-3 rounded-[4px] border border-current/25 font-mono-num text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-current/5"
            >
              NEW SESSION
            </button>
            <Link
              href="/"
              data-cursor="magnetic"
              className="py-3 rounded-[4px] bg-[var(--ink-vault)] text-[var(--bg-vault-paper)] font-mono-num text-xs font-semibold uppercase tracking-wider text-center"
            >
              COMMAND CENTER
            </Link>
          </div>
        </div>
      )}

      {stage === 'ABANDONED' && (
        <div className="max-w-lg mx-auto panel-surface rounded-[4px] p-7 space-y-5 border-[var(--accent-primary)]">
          <div className="flex items-center gap-3 pb-4 border-b border-[var(--border-hairline)]">
            <AlertTriangle className="w-5 h-5 text-[var(--accent-primary)]" strokeWidth={1.5} />
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Strict Stake Penalty Applied
              </h2>
              <div className="font-mono-num text-xs text-[var(--accent-primary)]">
                -{penaltyCR} CR DEBITED FROM LEDGER
              </div>
            </div>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Chamber broken early under Strict Stake mode for{' '}
            <strong className="text-[var(--text-primary)]">{taskLabel}</strong>.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              data-cursor="magnetic"
              onClick={() => setStage('IDLE')}
              className="py-2.5 rounded-[4px] panel-recessed font-mono-num text-xs uppercase tracking-wider text-[var(--text-primary)] cursor-pointer"
            >
              Recalibrate
            </button>
            <Link
              href="/"
              data-cursor="magnetic"
              className="py-2.5 rounded-[4px] bg-[var(--accent-primary)] text-white font-mono-num text-xs font-semibold uppercase tracking-wider text-center"
            >
              Command Center
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
