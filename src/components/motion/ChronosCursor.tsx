'use client';

import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

type CursorMode = 'default' | 'magnetic' | 'hold' | 'ledger' | 'text';

export function ChronosCursor() {
  const [enabled, setEnabled] = useState(false);

  const pipRef = useRef<HTMLDivElement>(null);
  const reticleRef = useRef<HTMLDivElement>(null);
  const crosshairsRef = useRef<SVGGElement>(null);
  const progressArcRef = useRef<SVGCircleElement>(null);
  const shockwaveRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const ibeamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (coarse || reduced) return;

    setEnabled(true);
    document.documentElement.classList.add('chronos-cursor-active');
    return () => {
      document.documentElement.classList.remove('chronos-cursor-active');
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const pip = pipRef.current;
    const reticle = reticleRef.current;
    const crosshairs = crosshairsRef.current;
    const progressArc = progressArcRef.current;
    const shockwave = shockwaveRef.current;
    const labelEl = labelRef.current;
    const ibeam = ibeamRef.current;
    if (!pip || !reticle || !crosshairs || !progressArc || !shockwave || !labelEl || !ibeam) return;

    const circ = 2 * Math.PI * 20;
    progressArc.style.strokeDasharray = String(circ);
    progressArc.style.strokeDashoffset = String(circ);

    const pipX = gsap.quickTo(pip, 'x', { duration: 0.08, ease: 'power3.out' });
    const pipY = gsap.quickTo(pip, 'y', { duration: 0.08, ease: 'power3.out' });
    const retX = gsap.quickTo(reticle, 'x', { duration: 0.35, ease: 'power3.out' });
    const retY = gsap.quickTo(reticle, 'y', { duration: 0.35, ease: 'power3.out' });
    const swX = gsap.quickTo(shockwave, 'x', { duration: 0.08, ease: 'power3.out' });
    const swY = gsap.quickTo(shockwave, 'y', { duration: 0.08, ease: 'power3.out' });

    let currentMode: CursorMode = 'default';
    let lockedEl: HTMLElement | null = null;

    const applyMode = (mode: CursorMode, badgeText = '') => {
      if (mode === currentMode && badgeText === labelEl.textContent) return;
      currentMode = mode;

      if (mode === 'default') {
        gsap.to(pip, { scale: 1, opacity: 1, duration: 0.18 });
        gsap.to(reticle, { scale: 1, width: 32, height: 32, opacity: 1, duration: 0.24, ease: 'power3.out' });
        gsap.to(ibeam, { opacity: 0, scaleY: 0.4, duration: 0.14 });
        gsap.to(labelEl, { opacity: 0, duration: 0.14 });
        labelEl.textContent = '';
      } else if (mode === 'magnetic') {
        gsap.to(pip, { scale: 0, opacity: 0, duration: 0.15 });
        gsap.to(reticle, { scale: 1.35, width: 32, height: 32, opacity: 1, duration: 0.24, ease: 'power3.out' });
        gsap.to(ibeam, { opacity: 0, duration: 0.12 });
        gsap.to(labelEl, { opacity: 0, duration: 0.12 });
      } else if (mode === 'hold') {
        gsap.to(pip, { scale: 0, opacity: 0, duration: 0.14 });
        gsap.to(reticle, { scale: 1.5, width: 32, height: 32, opacity: 1, duration: 0.24, ease: 'power3.out' });
        gsap.to(ibeam, { opacity: 0, duration: 0.12 });
        labelEl.textContent = 'HOLD';
        gsap.to(labelEl, { opacity: 1, duration: 0.18 });
      } else if (mode === 'ledger') {
        gsap.to(pip, { scale: 0, opacity: 0, duration: 0.14 });
        gsap.to(reticle, { scale: 1.25, width: 54, height: 24, opacity: 1, duration: 0.22, ease: 'power3.out' });
        gsap.to(ibeam, { opacity: 0, duration: 0.12 });
        labelEl.textContent = badgeText || 'VERIFY';
        gsap.to(labelEl, { opacity: 1, duration: 0.16 });
      } else if (mode === 'text') {
        gsap.to(pip, { scale: 0, opacity: 0, duration: 0.12 });
        gsap.to(reticle, { scale: 0.5, opacity: 0, duration: 0.16 });
        gsap.to(ibeam, { opacity: 1, scaleY: 1, duration: 0.16 });
        gsap.to(labelEl, { opacity: 0, duration: 0.1 });
      }
    };

    const onMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const cursorHost = target?.closest('[data-cursor]') as HTMLElement | null;
      const isTextInput =
        !cursorHost &&
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (isTextInput) {
        lockedEl = null;
        applyMode('text');
        pipX(e.clientX);
        pipY(e.clientY);
        retX(e.clientX);
        retY(e.clientY);
        swX(e.clientX);
        swY(e.clientY);
        return;
      }

      if (cursorHost) {
        const attr = cursorHost.getAttribute('data-cursor') as CursorMode;
        const badge = cursorHost.getAttribute('data-cursor-label') || '';
        lockedEl = attr === 'magnetic' ? cursorHost : null;
        applyMode(attr || 'default', badge);

        if (attr === 'magnetic' && lockedEl) {
          const rect = lockedEl.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          retX(cx + (e.clientX - cx) * 0.25);
          retY(cy + (e.clientY - cy) * 0.25);
          pipX(e.clientX);
          pipY(e.clientY);
          swX(e.clientX);
          swY(e.clientY);
          return;
        }
      } else {
        lockedEl = null;
        applyMode('default');
      }

      pipX(e.clientX);
      pipY(e.clientY);
      retX(e.clientX);
      retY(e.clientY);
      swX(e.clientX);
      swY(e.clientY);
    };

    const onDown = () => {
      gsap.to(reticle, { scale: currentMode === 'hold' ? 1.38 : 0.82, duration: 0.12, ease: 'power2.out' });
      gsap.fromTo(
        shockwave,
        { scale: 1, opacity: 0.45 },
        { scale: 1.9, opacity: 0, duration: 0.36, ease: 'power2.out' }
      );
    };

    const onUp = () => {
      const targetScale =
        currentMode === 'magnetic'
          ? 1.35
          : currentMode === 'hold'
            ? 1.5
            : currentMode === 'ledger'
              ? 1.25
              : 1;
      gsap.to(reticle, { scale: targetScale, duration: 0.18, ease: 'power2.out' });
      gsap.to(crosshairs, { rotation: 0, duration: 0.25, transformOrigin: '50% 50%' });
      progressArc.style.strokeDashoffset = String(circ);
    };

    const onHoldProgress = (evt: Event) => {
      const p = (evt as CustomEvent<{ progress: number }>).detail?.progress ?? 0;
      progressArc.style.strokeDashoffset = String(circ * (1 - p));
      gsap.set(crosshairs, { rotation: p * 90, transformOrigin: '50% 50%' });
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('chronos-hold-progress', onHoldProgress);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('chronos-hold-progress', onHoldProgress);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div aria-hidden="true" className="fixed inset-0 pointer-events-none z-[120]">
      {/* Click Shockwave Ring */}
      <div
        ref={shockwaveRef}
        className="fixed top-0 left-0 w-7 h-7 -ml-3.5 -mt-3.5 rounded-full border border-[var(--accent-primary)] opacity-0"
      />

      {/* Outer Horological Reticle */}
      <div
        ref={reticleRef}
        className="fixed top-0 left-0 w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full mix-blend-difference flex items-center justify-center"
      >
        <svg className="w-full h-full overflow-visible" viewBox="0 0 44 44" fill="none">
          <circle
            cx="22"
            cy="22"
            r="20"
            stroke="#F3EFE6"
            strokeOpacity="0.65"
            strokeWidth="1"
          />
          <circle
            ref={progressArcRef}
            cx="22"
            cy="22"
            r="20"
            stroke="#FF4D2D"
            strokeWidth="2"
            transform="rotate(-90 22 22)"
          />
          <g ref={crosshairsRef} stroke="#F3EFE6" strokeOpacity="0.85" strokeWidth="1">
            <line x1="22" y1="0" x2="22" y2="5" />
            <line x1="22" y1="39" x2="22" y2="44" />
            <line x1="0" y1="22" x2="5" y2="22" />
            <line x1="39" y1="22" x2="44" y2="22" />
          </g>
        </svg>

        <span
          ref={labelRef}
          className="absolute font-mono-num text-[7px] font-bold tracking-[0.14em] text-[#F3EFE6] uppercase opacity-0"
        />
      </div>

      {/* Inner Precision Pip (6px) */}
      <div
        ref={pipRef}
        className="fixed top-0 left-0 w-1.5 h-1.5 -ml-[3px] -mt-[3px] rounded-full bg-[var(--accent-primary)]"
      />

      {/* Vertical I-Beam for Text Inputs */}
      <div
        ref={ibeamRef}
        className="fixed top-0 left-0 w-[2px] h-5 -ml-[1px] -mt-2.5 bg-[var(--accent-primary)] opacity-0 animate-pulse"
      />
    </div>
  );
}
