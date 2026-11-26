'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useChronosStore } from '../store/useChronosStore';
import { acousticEngine } from '../lib/audio/acoustic-engine';
import { ActivePassBanner } from '../components/command/ActivePassBanner';
import { BalanceHeroCard } from '../components/command/BalanceHeroCard';
import { ShieldsCard } from '../components/command/ShieldsCard';
import { CryptographicLedgerCard } from '../components/command/CryptographicLedgerCard';

gsap.registerPlugin(Flip);

export default function CommandCenterPage() {
  const profile = useChronosStore((s) => s.profile);
  const userDoc = useChronosStore((s) => s.userDoc);
  const ledgerValid = useChronosStore((s) => s.ledgerValid);
  const lastSyncAt = useChronosStore((s) => s.lastSyncAt);
  const setUnlockTarget = useChronosStore((s) => s.setUnlockTarget);
  const lockEarlyAndRefund = useChronosStore((s) => s.lockEarlyAndRefund);
  const addBlockedDomain = useChronosStore((s) => s.addBlockedDomain);
  const setAuthModalOpen = useChronosStore((s) => s.setAuthModalOpen);
  const loginGoogle = useChronosStore((s) => s.loginGoogle);
  const loginGuest = useChronosStore((s) => s.loginGuest);

  const [now, setNow] = useState(Date.now());
  const [refundNotice, setRefundNotice] = useState<string | null>(null);
  const [authHint, setAuthHint] = useState(false);

  const flipContainerRef = useRef<HTMLDivElement>(null);
  const flipStateRef = useRef<Flip.FlipState | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'required') {
      setAuthHint(true);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const activePass =
    userDoc?.activePass && userDoc.activePass.expiresAt > now
      ? userDoc.activePass
      : null;

  useLayoutEffect(() => {
    if (!flipStateRef.current) return;
    const state = flipStateRef.current;
    flipStateRef.current = null;

    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      Flip.from(state, {
        duration: 0.34,
        ease: 'power3.inOut',
        absolute: false,
        nested: true,
      });
    });

    return () => mm.revert();
  }, [activePass?.domain]);

  const captureFlipBeforeAction = () => {
    if (flipContainerRef.current) {
      flipStateRef.current = Flip.getState(
        flipContainerRef.current.querySelectorAll('[data-flip-id]')
      );
    }
  };

  const handleLockEarly = async () => {
    captureFlipBeforeAction();
    const res = await lockEarlyAndRefund();
    if (res.refundedCR > 0) {
      setRefundNotice(`Locked ${res.domainLabel} early. +${res.refundedCR} CR refunded pro-rata.`);
    } else {
      setRefundNotice(`${res.domainLabel} shield engaged.`);
    }
    setTimeout(() => setRefundNotice(null), 4500);
  };

  if (!profile || !userDoc) {
    return (
      <div className="min-h-[72vh] flex items-center justify-center">
        <div className="w-full max-w-lg panel-surface rounded-[4px] p-8 space-y-6">
          <div className="space-y-3">
            <div className="font-mono-num text-[10px] uppercase tracking-[0.16em] text-[var(--accent-primary)]">
              CHRONOS // HOROLOGICAL ECONOMY
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] leading-tight">
              Attention is <span className="font-serif-accent italic font-normal">minted</span>, not spent.
            </h1>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Verified deep work mints bearer time-credits (<span className="font-mono-num text-[var(--text-primary)]">CR</span>).
              Hold intentionally to unlock distracted domains and lock early for pro-rata refunds.
            </p>
          </div>

          {authHint && (
            <div className="p-3 rounded-[4px] border border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 font-mono-num text-[11px] text-[var(--accent-primary)]">
              Sign in or continue as Guest to access Chamber &amp; Circle routes.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={loginGoogle}
              className="py-3 px-4 rounded-[4px] bg-[var(--bg-vault-paper)] text-[var(--ink-vault)] font-mono-num font-semibold text-xs uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer"
            >
              Google OAuth
            </button>
            <button
              type="button"
              onClick={loginGuest}
              className="py-3 px-4 rounded-[4px] bg-[var(--accent-primary)] text-white font-mono-num font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer"
            >
              <span>Continue as Guest</span>
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>

          <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between font-mono-num text-[11px] text-[var(--text-secondary)]">
            <span>EMAIL CREDENTIAL?</span>
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="text-[var(--accent-primary)] hover:underline cursor-pointer"
            >
              SIGN IN &rarr;
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={flipContainerRef} className="space-y-6">
      {activePass && (
        <ActivePassBanner activePass={activePass} now={now} onLockEarly={handleLockEarly} />
      )}

      {refundNotice && (
        <div className="p-3.5 rounded-[4px] border border-[var(--accent-jade)] bg-[var(--accent-jade)]/10 font-mono-num text-xs text-[var(--accent-jade)] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          <span>{refundNotice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 flex flex-col gap-6">
          <BalanceHeroCard
            wallet={userDoc.wallet}
            blockedDomains={userDoc.settings.blockedDomains}
            preset={userDoc.settings.preset}
            earnRatePerMin={userDoc.settings.earnRatePerMin}
            ledgerValid={ledgerValid}
          />

          <ShieldsCard
            domains={userDoc.settings.blockedDomains}
            activePass={activePass}
            onUnlockClick={(dom) => {
              captureFlipBeforeAction();
              acousticEngine.playTick();
              setUnlockTarget(dom);
            }}
            onLockEarly={handleLockEarly}
            onAddDomain={addBlockedDomain}
          />
        </div>

        <div className="lg:col-span-5">
          <CryptographicLedgerCard
            blocks={userDoc.ledger}
            lastBlockHash={userDoc.wallet.lastBlockHash}
            lastSyncAt={lastSyncAt}
          />
        </div>
      </div>
    </div>
  );
}
