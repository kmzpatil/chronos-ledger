'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

/**
 * Attaches subtle ±4px magnetic pull on pointer-fine desktop devices.
 * Respects prefers-reduced-motion.
 */
export function useMagnetic<T extends HTMLElement = HTMLElement>(strength = 4) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined') return;

    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (coarse || reduced) return;

    const xTo = gsap.quickTo(el, 'x', { duration: 0.3, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.3, ease: 'power3.out' });

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / Math.max(1, rect.width) - 0.5;
      const relY = (e.clientY - rect.top) / Math.max(1, rect.height) - 0.5;
      xTo(relX * strength * 2);
      yTo(relY * strength * 2);
    };

    const onLeave = () => {
      xTo(0);
      yTo(0);
    };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      gsap.set(el, { x: 0, y: 0 });
    };
  }, [strength]);

  return ref;
}
