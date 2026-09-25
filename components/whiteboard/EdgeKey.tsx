'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { springSoft } from '@/lib/motion';
import { OUTCOME_COLOR } from './TradeNode';

/**
 * What the lines mean.
 *
 * Three kinds of line are drawn on this board and none of them said so. A
 * branch is structure, a chain is order, and a leak is the only one that is
 * an actual finding — and a repeating leak is the single most useful thing
 * the board computes, so it is worth naming rather than leaving as "some red
 * dashes". Every line is faint until you point at what it joins, which is
 * also worth saying once rather than leaving to be discovered.
 */
export function EdgeKey({ chains, leaks }: { chains: boolean; leaks: boolean }) {
  /*
    Folded to a chip until pointed at. Open all the time, the key sat on top
    of the board's bottom-left corner — at 100% there is always a group there.
  */
  const [open, setOpen] = useState(false);
  return (
    <div
      className="pointer-events-auto"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.div
            key="open"
            data-edge-key="open"
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98, transition: { duration: 0.1 } }}
            transition={springSoft}
            style={{ transformOrigin: 'bottom left', width: 'max-content' }}
            className="glass rounded-[calc(14px*var(--rk))] px-3 py-2.5"
          >
            <p className="mb-1.5 text-[9px] uppercase tracking-[0.12em]" style={{ color: 'var(--text-faint)' }}>
              Lines
            </p>
            <Row label="group" hint="a group of trades">
              <line x1="1" y1="5" x2="31" y2="5" stroke="var(--text-dim)" strokeWidth="1.6" />
            </Row>
            {chains && (
              <Row label="in order" hint="oldest to newest inside a group">
                <line x1="1" y1="5" x2="31" y2="5" stroke="var(--text-dim)"
                  strokeWidth="1.6" strokeDasharray="1 4" strokeLinecap="round" />
              </Row>
            )}
            {leaks && (
              <Row label="same leak" hint="both lost, same target type">
                <line x1="1" y1="5" x2="31" y2="5" stroke={`rgb(${OUTCOME_COLOR.Loss})`}
                  strokeWidth="1.8" strokeDasharray="5 3" />
              </Row>
            )}
            <p className="mt-2 max-w-[13rem] text-[10px] leading-snug" style={{ color: 'var(--text-faint)' }}>
              Faint until you point at a card or a group — then its own lines come up.
            </p>
          </motion.div>
        ) : (
          <motion.button
            key="chip"
            type="button"
            data-edge-key="chip"
            aria-label="What the lines mean"
            onFocus={() => setOpen(true)}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={springSoft}
            className="glass flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-medium"
            style={{ color: 'var(--text-dim)' }}
          >
            <svg width="18" height="8" viewBox="0 0 18 8" aria-hidden>
              <line x1="1" y1="2" x2="17" y2="2" stroke="currentColor" strokeWidth="1.4" />
              <line x1="1" y1="6" x2="17" y2="6" stroke={`rgb(${OUTCOME_COLOR.Loss})`} strokeWidth="1.4" strokeDasharray="3 2" />
            </svg>
            Lines
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, hint, children }: {
  label: string; hint: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2 py-[3px]">
      <svg width="32" height="10" viewBox="0 0 32 10" aria-hidden className="shrink-0 translate-y-[3px]">
        {children}
      </svg>
      <span className="text-[11px] font-medium">{label}</span>
      <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{hint}</span>
    </div>
  );
}
