'use client';

import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import Lenis from 'lenis';
import { Plus, Copy, Check, Radio, Zap } from 'lucide-react';
import { useChronosStore } from '../../store/useChronosStore';
import { acousticEngine } from '../../lib/audio/acoustic-engine';

export default function StudyCirclePage() {
  const profile = useChronosStore((s) => s.profile);
  const circles = useChronosStore((s) => s.circles);
  const createCircle = useChronosStore((s) => s.createCircle);
  const joinCircle = useChronosStore((s) => s.joinCircle);
  const pulseFocus = useChronosStore((s) => s.pulseFocus);

  const [selectedCircleId, setSelectedCircleId] = useState<string>('');
  const [newCircleName, setNewCircleName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const rosterRef = useRef<HTMLDivElement>(null);
  const radarRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const rowSweepRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (circles.length > 0 && !selectedCircleId) {
      setSelectedCircleId(circles[0].circleId);
    }
  }, [circles, selectedCircleId]);

  useEffect(() => {
    const wrapper = rosterRef.current;
    if (!wrapper) return;
    const content = wrapper.firstElementChild as HTMLElement | null;
    if (!content) return;

    const lenis = new Lenis({
      wrapper,
      content,
      duration: 0.95,
      smoothWheel: true,
    });
    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [selectedCircleId, circles.length]);

  // Calm radar ring animation on active FOCUSING members
  useEffect(() => {
    const rings = radarRefs.current.filter(Boolean) as HTMLSpanElement[];
    if (rings.length === 0) return;

    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      rings.forEach((ring, idx) => {
        gsap.fromTo(
          ring,
          { scale: 1, opacity: 0.55 },
          {
            scale: 1.9,
            opacity: 0,
            duration: 2.4,
            repeat: -1,
            delay: idx * 0.4,
            ease: 'power1.out',
          }
        );
      });
    });

    return () => {
      gsap.killTweensOf(rings);
      mm.revert();
    };
  }, [circles, selectedCircleId]);

  // Animate feedback slide-down when shown
  useEffect(() => {
    if (!feedback || !feedbackRef.current) return;
    gsap.fromTo(
      feedbackRef.current,
      { y: -8, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.25, ease: 'power3.out' }
    );
  }, [feedback]);

  const activeCircle =
    circles.find((c) => c.circleId === selectedCircleId) || circles[0] || null;

  const myMember = activeCircle?.members.find((m) => m.uid === profile?.uid);
  const amFocusing = Boolean(myMember?.isFocusingNow);

  const sortedMembers = activeCircle
    ? [...activeCircle.members].sort(
        (a, b) => b.weeklyVerifiedMinutes - a.weeklyVerifiedMinutes
      )
    : [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCircleName.trim()) return;
    const created = await createCircle(newCircleName);
    if (created) {
      setSelectedCircleId(created.circleId);
      setNewCircleName('');
      setFeedback(`Pod "${created.name}" initialized (Invite: ${created.inviteCode}).`);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    const res = await joinCircle(joinCode);
    if (res.ok) {
      setJoinCode('');
      setFeedback('Joined Study Circle.');
    } else {
      setFeedback(res.error || 'Could not join circle.');
    }
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleCopyInvite = () => {
    if (!activeCircle) return;
    navigator.clipboard?.writeText(activeCircle.inviteCode);
    acousticEngine.playTick();
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSendPulse = (uid: string, peerName: string) => {
    acousticEngine.playVaultEngage(1);
    const sweepEl = rowSweepRefs.current[uid];
    if (sweepEl) {
      gsap.fromTo(
        sweepEl,
        { xPercent: -100, opacity: 0.6 },
        { xPercent: 100, opacity: 0, duration: 0.65, ease: 'power2.out' }
      );
    }
    setFeedback(`Pulse sent to ${peerName}.`);
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div
        data-animate-panel
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]"
      >
        <div>
          <div className="font-mono-num text-[10px] uppercase tracking-[0.16em] text-[var(--accent-primary)]">
            03 // CO-WORKING ACCOUNTABILITY POD
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-0.5">
            Study <span className="font-serif-accent italic font-normal">Circle</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            data-cursor="magnetic"
            onClick={() =>
              pulseFocus(!amFocusing, !amFocusing ? 'Deep Study Session' : null)
            }
            className={`px-3.5 py-2 rounded-[4px] border font-mono-num text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              amFocusing
                ? 'border-[var(--accent-jade)] bg-[var(--accent-jade)]/12 text-[var(--accent-jade)]'
                : 'panel-recessed text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Radio className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>{amFocusing ? 'Live: Focusing' : 'Broadcast Focus'}</span>
          </button>

          {activeCircle && (
            <button
              type="button"
              data-cursor="magnetic"
              onClick={handleCopyInvite}
              className="px-3.5 py-2 rounded-[4px] panel-surface hover:border-[var(--accent-primary)] font-mono-num text-[11px] uppercase tracking-wider flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <span className="text-[var(--text-secondary)]">INVITE CODE:</span>
              <span className="text-[var(--accent-primary)] font-bold">
                {activeCircle.inviteCode}
              </span>
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-[var(--accent-jade)]" strokeWidth={1.5} />
              ) : (
                <Copy className="w-3.5 h-3.5 text-[var(--text-secondary)]" strokeWidth={1.5} />
              )}
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          ref={feedbackRef}
          className="p-3 rounded-[4px] border border-[var(--accent-jade)] bg-[var(--accent-jade)]/10 font-mono-num text-xs text-[var(--accent-jade)]"
        >
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section
          data-animate-panel
          className="lg:col-span-8 panel-surface rounded-[4px] flex flex-col"
        >
          <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-mono-num text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)]">
                {activeCircle ? activeCircle.name : 'NO POD SELECTED'}
              </span>
              <span className="font-mono-num text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[2px] panel-recessed text-[var(--text-secondary)]">
                4H/DAY CAP
              </span>
            </div>

            {circles.length > 1 && (
              <div className="flex gap-1.5 flex-wrap">
                {circles.map((c) => (
                  <button
                    key={c.circleId}
                    type="button"
                    data-cursor="magnetic"
                    onClick={() => setSelectedCircleId(c.circleId)}
                    className={`px-2.5 py-1 rounded-[2px] font-mono-num text-[10px] uppercase tracking-wider cursor-pointer ${
                      c.circleId === activeCircle?.circleId
                        ? 'border border-[var(--accent-primary)] text-[var(--text-primary)]'
                        : 'panel-recessed text-[var(--text-secondary)]'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div ref={rosterRef} className="h-[420px] overflow-y-auto px-5">
            <div className="divide-y divide-[var(--border-hairline)]">
              {sortedMembers.map((m, idx) => {
                const isMe = m.uid === profile?.uid;
                const rankStr = String(idx + 1).padStart(2, '0');
                return (
                  <div
                    key={m.uid}
                    data-cursor={m.isFocusingNow ? 'ledger' : undefined}
                    data-cursor-label={m.isFocusingNow ? 'PULSE' : undefined}
                    className={`relative overflow-hidden py-4 flex items-center justify-between gap-4 ${
                      isMe ? 'bg-white/[0.03] -mx-5 px-5' : ''
                    }`}
                  >
                    {/* Horizontal Jade Pulse Ripple */}
                    <div
                      ref={(el) => {
                        rowSweepRefs.current[m.uid] = el;
                      }}
                      aria-hidden="true"
                      className="absolute inset-0 pointer-events-none opacity-0"
                      style={{
                        background:
                          'linear-gradient(90deg, transparent, rgba(18, 184, 134, 0.25), transparent)',
                      }}
                    />

                    <div className="relative z-10 flex items-center gap-4 min-w-0">
                      <span className="font-mono-num text-xs font-bold text-[var(--text-tertiary)] w-6 shrink-0">
                        {rankStr}
                      </span>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                            {m.displayName}
                          </span>
                          {isMe && (
                            <span className="font-mono-num text-[10px] uppercase px-1.5 py-0.5 rounded-[2px] border border-[var(--accent-primary)] text-[var(--accent-primary)]">
                              YOU
                            </span>
                          )}
                          {m.isFocusingNow && (
                            <span className="inline-flex items-center gap-1.5 font-mono-num text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[2px] bg-[var(--accent-jade)]/12 text-[var(--accent-jade)] border border-[var(--accent-jade)]/40">
                              <span className="relative flex w-2 h-2 items-center justify-center">
                                <span
                                  ref={(el) => {
                                    radarRefs.current[idx] = el;
                                  }}
                                  className="absolute inset-0 rounded-full bg-[var(--accent-jade)]"
                                />
                                <span className="relative w-1.5 h-1.5 rounded-full bg-[var(--accent-jade)]" />
                              </span>
                              <span>FOCUSING</span>
                            </span>
                          )}
                        </div>
                        <div className="font-mono-num text-[11px] text-[var(--text-secondary)] truncate">
                          {m.isFocusingNow && m.currentTaskTag
                            ? m.currentTaskTag
                            : `${m.weeklyDaysHit} days active this week`}
                        </div>
                      </div>
                    </div>

                    <div className="relative z-10 flex items-center gap-4 shrink-0">
                      {!isMe && (
                        <button
                          type="button"
                          data-cursor="magnetic"
                          onClick={() => handleSendPulse(m.uid, m.displayName)}
                          className="px-3 py-1.5 rounded-[4px] panel-recessed hover:border-[var(--accent-ochre)] font-mono-num text-[10px] uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--accent-ochre)] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Zap className="w-3 h-3 text-[var(--accent-ochre)]" strokeWidth={1.5} />
                          <span>Send Pulse</span>
                        </button>
                      )}

                      <div className="text-right font-mono-num min-w-[68px]">
                        <div className="text-sm font-bold text-[var(--accent-jade)]">
                          {m.weeklyVerifiedMinutes}M
                        </div>
                        <div className="text-[10px] text-[var(--text-tertiary)] uppercase">
                          VERIFIED
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <div data-animate-panel className="lg:col-span-4 space-y-6">
          <form onSubmit={handleJoin} className="panel-surface rounded-[4px] p-5 space-y-3">
            <label className="block font-mono-num text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
              JOIN POD // 6-CHAR INVITE CODE
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="CHR942"
                className="flex-1 px-3.5 py-2.5 rounded-[4px] panel-recessed font-mono-num text-xs text-[var(--text-primary)] uppercase placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
              <button
                type="submit"
                data-cursor="magnetic"
                className="px-4 py-2.5 rounded-[4px] bg-[var(--accent-primary)] text-white font-mono-num text-xs font-semibold uppercase tracking-wider cursor-pointer"
              >
                JOIN
              </button>
            </div>
          </form>

          <form onSubmit={handleCreate} className="panel-surface rounded-[4px] p-5 space-y-3">
            <label className="block font-mono-num text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
              CREATE PRIVATE POD (MAX 12)
            </label>
            <input
              type="text"
              value={newCircleName}
              onChange={(e) => setNewCircleName(e.target.value)}
              placeholder="e.g. Systems Finals Pod"
              className="w-full px-3.5 py-2.5 rounded-[4px] panel-recessed text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
            <button
              type="submit"
              data-cursor="magnetic"
              className="w-full py-2.5 rounded-[4px] panel-recessed hover:border-[var(--accent-primary)] font-mono-num text-xs font-medium uppercase tracking-wider text-[var(--text-primary)] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[var(--accent-primary)]" strokeWidth={1.5} />
              <span>Initialize Pod</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
