'use client';

import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { useGSAP } from '@gsap/react';
import { useChronosStore } from '../../store/useChronosStore';

gsap.registerPlugin(CustomEase, useGSAP);

const SESSION_BOOT_KEY = 'chronos_preloader_done_v1';

export function ChronosPreloader() {
  const bootStage = useChronosStore((s) => s.bootStage);
  const bootProgress = useChronosStore((s) => s.bootProgress);

  const [dismissed, setDismissed] = useState<boolean>(true);
  const [flashVerified, setFlashVerified] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const topCurtainRef = useRef<HTMLDivElement>(null);
  const bottomCurtainRef = useRef<HTMLDivElement>(null);
  const hairlineRef = useRef<HTMLDivElement>(null);
  const dialGroupRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!sessionStorage.getItem(SESSION_BOOT_KEY)) {
      setDismissed(false);
    }
  }, []);

  const radius = 44;
  const circumference = 2 * Math.PI * radius;

  // 60 radial tick marks for horological bezel
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const angle = (i * 6 * Math.PI) / 180;
    const isMajor = i % 5 === 0;
    const rOuter = 54;
    const rInner = isMajor ? 47 : 50;
    return {
      x1: 60 + rInner * Math.sin(angle),
      y1: 60 - rInner * Math.cos(angle),
      x2: 60 + rOuter * Math.sin(angle),
      y2: 60 - rOuter * Math.cos(angle),
      isMajor,
    };
  });

  useGSAP(
    () => {
      if (dismissed || bootStage !== 'READY') return;

      try {
        CustomEase.create('chronosSnap', '0.85, 0, 0.15, 1');
      } catch {
        // already registered
      }

      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: reduce)', () => {
        setFlashVerified(true);
        gsap.to(rootRef.current, {
          opacity: 0,
          duration: 0.25,
          delay: 0.15,
          onComplete: () => {
            sessionStorage.setItem(SESSION_BOOT_KEY, '1');
            setDismissed(true);
          },
        });
      });

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const tl = gsap.timeline({
          onComplete: () => {
            sessionStorage.setItem(SESSION_BOOT_KEY, '1');
            setDismissed(true);
          },
        });

        // 0.65s full 60-tick dial sweep
        tl.fromTo(
          sweepRef.current,
          { strokeDashoffset: circumference },
          {
            strokeDashoffset: 0,
            duration: 0.65,
            ease: 'power2.inOut',
            onComplete: () => setFlashVerified(true),
          }
        )
          .to(dialGroupRef.current, {
            opacity: 0,
            scale: 0.96,
            duration: 0.18,
            delay: 0.12,
            ease: 'power2.in',
          })
          .fromTo(
            hairlineRef.current,
            { scaleX: 0, opacity: 1 },
            { scaleX: 1, duration: 0.24, ease: 'chronosSnap' },
            '-=0.04'
          )
          .to(
            [topCurtainRef.current, bottomCurtainRef.current],
            {
              yPercent: (idx: number) => (idx === 0 ? -100 : 100),
              duration: 0.42,
              ease: 'chronosSnap',
            },
            'split'
          )
          .to(hairlineRef.current, { opacity: 0, duration: 0.16 }, 'split+=0.08');
      });

      return () => mm.revert();
    },
    { scope: rootRef, dependencies: [bootStage, dismissed, circumference] }
  );

  if (dismissed) return null;

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="fixed inset-0 z-[100] pointer-events-auto flex flex-col items-center justify-center"
    >
      <div
        ref={topCurtainRef}
        className="absolute inset-x-0 top-0 h-1/2 bg-[#0A0E14] border-b border-[rgba(243,239,230,0.1)]"
      />
      <div
        ref={bottomCurtainRef}
        className="absolute inset-x-0 bottom-0 h-1/2 bg-[#0A0E14] border-t border-[rgba(243,239,230,0.1)]"
      />

      <div
        ref={hairlineRef}
        className="relative z-10 w-full h-[1px] bg-[#FF4D2D] origin-center scale-x-0"
      />

      <div ref={dialGroupRef} className="absolute z-20 flex flex-col items-center gap-4">
        <div className="relative w-32 h-32 flex items-center justify-center">
          <svg className="w-32 h-32" viewBox="0 0 120 120">
            {ticks.map((t, i) => (
              <line
                key={i}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke="#F3EFE6"
                strokeOpacity={t.isMajor ? 0.5 : 0.16}
                strokeWidth={t.isMajor ? 1.5 : 1}
              />
            ))}
            <circle
              ref={sweepRef}
              cx="60"
              cy="60"
              r={radius}
              stroke="#FF4D2D"
              strokeWidth="2"
              strokeDasharray={circumference}
              strokeDashoffset={circumference}
              fill="none"
              transform="rotate(-90 60 60)"
            />
          </svg>
          <span className="absolute font-mono-num text-xs font-semibold tracking-widest text-[#F3EFE6]">
            {bootProgress}%
          </span>
        </div>

        <div
          className={`font-mono-num text-[11px] tracking-[0.18em] uppercase transition-colors ${
            flashVerified ? 'text-[#12B886]' : 'text-[#9CA3AF]'
          }`}
        >
          {flashVerified ? 'LEDGER VERIFIED' : `CALIBRATING // ${bootStage}`}
        </div>
      </div>
    </div>
  );
}
