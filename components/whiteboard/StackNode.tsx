'use client';

import { motion } from 'framer-motion';
import { press, spring } from '@/lib/motion';

export interface StackNodeData {
  count: number;
  accent: string;
  label: string;
  onOpen: () => void;
  scale: number;
}

/**
 * The tile that stands for the cards a group is not showing.
 *
 * Drawn as a short deck rather than a card, so it reads as "there is more
 * behind this" instead of as another trade. A group of forty rendered as forty
 * cards is a wall, not information — the two that matter are the two you just
 * took, and the rest are one click away.
 */
export function StackNode({ data }: { data: StackNodeData }) {
  const { count, accent, label, onOpen, scale } = data as unknown as StackNodeData;

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={{ scale: 1.03 }}
      whileTap={press}
      transition={spring}
      title={`${count} more in ${label} — click to see them all`}
      className="relative block h-full w-full text-left"
    >
      {/* Two offset plates behind the face, so the depth is the affordance. */}
      <span className="absolute inset-x-2 -bottom-1.5 top-3 rounded-[16px]"
        style={{ background: `rgb(${accent} / 0.10)`, border: `1px solid rgb(${accent} / 0.18)` }} />
      <span className="absolute inset-x-1 -bottom-0.5 top-1.5 rounded-[16px]"
        style={{ background: `rgb(${accent} / 0.14)`, border: `1px solid rgb(${accent} / 0.24)` }} />

      <span
        className="glass absolute inset-0 grid place-items-center rounded-[16px]"
        style={{ borderColor: `rgb(${accent} / 0.4)` }}
      >
        <span className="text-center leading-none">
          <span className="block font-semibold tabular-nums tracking-tight"
            style={{ fontSize: 30 * scale, color: `rgb(${accent})` }}>
            +{count}
          </span>
          <span className="mt-1.5 block" style={{ fontSize: 11 * scale, color: 'var(--text-faint)' }}>
            {count === 1 ? 'more trade' : 'more trades'}
          </span>
          <span className="mt-0.5 block" style={{ fontSize: 10 * scale, color: 'var(--text-faint)' }}>
            click to open
          </span>
        </span>
      </span>
    </motion.button>
  );
}
