'use client';

import React, { useRef } from 'react';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ensureChronosEases } from '../../lib/motion/eases';

gsap.registerPlugin(useGSAP);

export function PageTransitionWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      ensureChronosEases();
      const root = containerRef.current;
      if (!root) return;

      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const targets = root.querySelectorAll('[data-animate-panel]');
        const animTargets = targets.length > 0 ? targets : [root];

        gsap.fromTo(
          animTargets,
          { y: 14, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.45,
            stagger: 0.05,
            ease: 'chronosSilk',
            clearProps: 'transform',
          }
        );
      });

      return () => mm.revert();
    },
    { scope: containerRef, dependencies: [pathname] }
  );

  return (
    <div ref={containerRef} key={pathname}>
      {children}
    </div>
  );
}
