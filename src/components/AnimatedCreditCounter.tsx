'use client';

import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

interface AnimatedCreditCounterProps {
  value: number;
  className?: string;
  suffix?: string;
  suffixClassName?: string;
}

export function AnimatedCreditCounter({
  value,
  className = '',
  suffix = 'CR',
  suffixClassName = '',
}: AnimatedCreditCounterProps) {
  const [displayed, setDisplayed] = useState(value);
  const proxyRef = useRef({ val: value });
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: reduce)', () => {
      proxyRef.current.val = value;
      setDisplayed(value);
    });

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const prev = proxyRef.current.val;
      if (prev === value) return;

      gsap.to(proxyRef.current, {
        val: value,
        duration: 0.6,
        ease: 'power3.out',
        onUpdate: () => {
          setDisplayed(Math.round(proxyRef.current.val));
        },
      });

      if (containerRef.current) {
        gsap.fromTo(
          containerRef.current,
          { y: value > prev ? 8 : -8, opacity: 0.55 },
          { y: 0, opacity: 1, duration: 0.28, ease: 'power2.out' }
        );
      }
    });

    return () => mm.revert();
  }, [value]);

  return (
    <span
      ref={containerRef}
      className={`inline-flex items-baseline font-mono-num tabular-nums ${className}`}
    >
      <span>{displayed.toLocaleString()}</span>
      {suffix && (
        <span className={`ml-2.5 text-[0.34em] font-semibold tracking-widest uppercase ${suffixClassName}`}>
          {suffix.trim()}
        </span>
      )}
    </span>
  );
}
