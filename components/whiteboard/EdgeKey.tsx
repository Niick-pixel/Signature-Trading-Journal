'use client';

import { motion } from 'framer-motion';
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
      className="glass pointer-events-none rounded-[14px] px-3 py-2.5"
      style={{ width: 'max-content' }}
    >
      <p className="mb-1.5 text-[9px] uppercase tracking-[0.12em]"
        style={{ color: 'var(--text-faint)' }}>
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

      <p className="mt-2 max-w-[13rem] text-[10px] leading-snug"
        style={{ color: 'var(--text-faint)' }}>
        Faint until you point at a card or a group — then its own lines come up.
      </p>
    </motion.div>
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
