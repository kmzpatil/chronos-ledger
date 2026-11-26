'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import Lenis from 'lenis';
import { LedgerBlock } from '../../types/chronos';
import { acousticEngine } from '../../lib/audio/acoustic-engine';

gsap.registerPlugin(Flip);

interface CryptographicLedgerCardProps {
  blocks: LedgerBlock[];
  lastBlockHash: string;
  lastSyncAt: number;
}

export function CryptographicLedgerCard({
  blocks,
  lastBlockHash,
  lastSyncAt,
}: CryptographicLedgerCardProps) {
  const [filter, setFilter] = useState<'ALL' | 'MINT' | 'SPEND'>('ALL');
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const flipStateRef = useRef<Flip.FlipState | null>(null);

  useEffect(() => {
    const wrapper = scrollRef.current;
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
    const raf = (t: number) => {
      lenis.raf(t);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [blocks.length]);

  useLayoutEffect(() => {
    if (!flipStateRef.current) return;
    const state = flipStateRef.current;
    flipStateRef.current = null;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      Flip.from(state, {
        duration: 0.34,
        ease: 'power3.out',
        stagger: 0.025,
        onEnter: (els) =>
          gsap.fromTo(els, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.25 }),
      });
    });
    return () => mm.revert();
  }, [filter, blocks.length]);

  const handleFilterChange = (tab: 'ALL' | 'MINT' | 'SPEND') => {
    if (listRef.current) {
      flipStateRef.current = Flip.getState(listRef.current.querySelectorAll('[data-flip-row]'));
    }
    acousticEngine.playTick();
    setFilter(tab);
  };

  const filtered = [...blocks].reverse().filter((blk) => {
    if (filter === 'MINT') return blk.amount > 0;
    if (filter === 'SPEND') return blk.amount < 0;
    return true;
  });

  const headHex = `0x${lastBlockHash.slice(0, 4).toUpperCase()}...${lastBlockHash
    .slice(-4)
    .toUpperCase()}`;

  return (
    <section
      data-animate-panel
      className="panel-surface rounded-[4px] h-full flex flex-col justify-between min-h-[480px]"
    >
      <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between gap-2 shrink-0">
        <span className="font-mono-num text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)]">
          CRYPTOGRAPHIC LEDGER
        </span>

        <div className="flex items-center gap-4 font-mono-num text-[10px] tracking-[0.12em]">
          {(['ALL', 'MINT', 'SPEND'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              data-cursor="magnetic"
              onClick={() => handleFilterChange(tab)}
              className={`pb-1 border-b-2 transition-colors cursor-pointer ${
                filter === tab
                  ? 'border-[var(--accent-primary)] text-[var(--text-primary)] font-semibold'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 max-h-[400px] overflow-y-auto px-5 py-2">
        <div ref={listRef} className="divide-y divide-[var(--border-hairline)]">
          {filtered.length === 0 ? (
            <div className="py-16 text-center font-mono-num text-[11px] text-[var(--text-secondary)] uppercase tracking-wider">
              NO MATCHING ENTRIES
            </div>
          ) : (
            filtered.map((blk) => {
              const isPos = blk.amount >= 0;
              return (
                <div
                  key={blk.index}
                  data-flip-row={`blk-${blk.index}`}
                  data-cursor="ledger"
                  data-cursor-label="VERIFY"
                  className="py-3.5 pl-3 flex items-start justify-between gap-3 relative hover:bg-white/[0.02] transition-colors"
                  style={{
                    borderLeft: `2px solid ${
                      isPos ? 'var(--accent-jade)' : 'var(--accent-primary)'
                    }`,
                  }}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="text-xs font-medium text-[var(--text-primary)] truncate">
                      {blk.metadata.label}
                    </div>
                    <div className="font-mono-num text-[10px] text-[var(--text-secondary)] flex items-center gap-2">
                      <span>BLK #{blk.index}</span>
                      <span>·</span>
                      <span>
                        {new Date(blk.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span>·</span>
                      <span className="text-[var(--text-tertiary)]">
                        {blk.signature.slice(0, 8)}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`font-mono-num text-xs font-semibold shrink-0 tabular-nums ${
                      isPos ? 'text-[var(--accent-jade)]' : 'text-[var(--accent-primary)]'
                    }`}
                  >
                    {isPos ? `+${blk.amount}` : blk.amount} CR
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="px-5 py-3 border-t border-[var(--border-hairline)] panel-recessed flex items-center justify-between font-mono-num text-[10px] tracking-wider text-[var(--text-secondary)] shrink-0">
        <span>
          CHAIN HEAD: <strong className="text-[var(--text-primary)]">{headHex}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-jade)] animate-pulse" />
          <span>
            {new Date(lastSyncAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </span>
      </div>
    </section>
  );
}
