'use client';

import { memo } from 'react';
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
function StackNodeInner({ data }: { data: StackNodeData }) {
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
      <span className="absolute inset-x-2 -bottom-1.5 top-3 rounded-[calc(16px*var(--rk))]"
        style={{ background: `rgb(${accent} / 0.10)`, border: `1px solid rgb(${accent} / 0.18)` }} />
      <span className="absolute inset-x-1 -bottom-0.5 top-1.5 rounded-[calc(16px*var(--rk))]"
        style={{ background: `rgb(${accent} / 0.14)`, border: `1px solid rgb(${accent} / 0.24)` }} />

      <span
        className="glass absolute inset-0 grid place-items-center rounded-[calc(16px*var(--rk))]"
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

/*
  Re-render only when what the node shows changes.

  React Flow hands every node its absolute position as a prop, so moving a
  group gave each card inside it new props on every frame of the drag — and
  each card re-rendered, with Framer measuring its layout each time. That was
  most of the 55ms of script per pointer move. What a node draws depends on its
  data alone; its position is applied by React Flow to the wrapper around it.
*/
export const StackNode = memo(StackNodeInner, (a, b) => a.data === b.data);
