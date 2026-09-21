'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

/** Both a source and a target on each face, so any direction has a short route. */
const SIDES: Array<[string, Position]> = [
  ['t-top', Position.Top], ['s-top', Position.Top],
  ['t-right', Position.Right], ['s-right', Position.Right],
  ['t-bottom', Position.Bottom], ['s-bottom', Position.Bottom],
  ['t-left', Position.Left], ['s-left', Position.Left],
];
import { motion } from 'framer-motion';
import { GRADE_COLOR, gradeLetter } from '@/lib/grade';
import { spring, springLayout } from '@/lib/motion';
import { NODE_H, NODE_W } from '@/lib/layout';
import type { Outcome } from '@/lib/domain';
import type { Trade } from '@/lib/types';
import { hasOpenFlags } from '@/lib/flags';

/** Border colour carries the outcome. Nothing else on the card does. */
export const OUTCOME_COLOR: Record<Outcome, string> = {
  Win: 'var(--outcome-win)',
  Loss: 'var(--outcome-loss)',
  Breakeven: 'var(--outcome-neutral)',
  Scratched: 'var(--outcome-neutral)',
  'Not taken': 'var(--outcome-passed)',
};

export type TradeNodeData = {
  trade: Trade;
  selected: boolean;
  onOpen: (id: string) => void;
  scale: number;
  dimPassed: boolean;
};

function TradeNodeInner({ data }: NodeProps) {
  const { trade, selected, onOpen, scale = 1, dimPassed = true } = data as unknown as TradeNodeData;
  const outcome = OUTCOME_COLOR[trade.outcome];
  const grade = GRADE_COLOR[gradeLetter(trade.checklist_score)];
  const passed = trade.outcome === 'Not taken';
  // Descriptive, never blocking — it was saved exactly as written. The dot
  // just means there is a contradiction worth a look at review time.
  const flagged = hasOpenFlags(trade);

  return (
    <>
    {/*
      The handles sit OUTSIDE the animated card, as siblings of it.

      Two reasons, and both of them were drawing lines in the wrong place.
      A handle on every side lets an edge leave and arrive on the faces that
      point at each other, instead of the old top/bottom-only pair that made a
      link between two cards side by side loop out around the whole cluster.

      And they cannot live inside the card, because the card is a motion.div
      with `layout` and a hover that lifts it 3px and scales it. Framer draws
      all of that as a transform, which carries anything inside it — so React
      Flow measured handle positions that were mid-animation, and the lines
      ended up anchored to where the card briefly was rather than where it is.
      Out here, nothing Framer does to the card can move them.
    */}
    {SIDES.map(([id, position]) => (
      <Handle key={id} id={id} type={id.startsWith('s-') ? 'source' : 'target'}
        position={position} style={{ opacity: 0, pointerEvents: 'none' }} />
    ))}

    <motion.div
      layout
      layoutId={`trade-${trade.id}`}
      transition={springLayout}
      whileHover={{ y: -3, scale: 1.02 }}
      whileTap={{ scale: 0.985 }}
      onClick={() => onOpen(trade.id)}
      style={{
        width: NODE_W * scale,
        height: NODE_H * scale,
        borderColor: `rgb(${outcome} / ${passed ? 0.35 : 0.65})`,
        boxShadow: selected
          ? `var(--shadow-panel), 0 0 34px rgb(${outcome} / 0.5)`
          : `var(--shadow-card), 0 0 16px rgb(${outcome} / 0.16)`,
        opacity: passed && dimPassed ? 0.62 : 1,
      }}
      className="group glass relative cursor-pointer overflow-hidden rounded-[18px]"
    >
      {flagged && (
        <span
          title="This record contradicts itself — open it to see how"
          className="absolute left-2 top-[38px] z-[4] size-2 rounded-full"
          style={{
            background: 'rgb(var(--amber))',
            boxShadow: '0 0 8px rgb(var(--amber) / 0.9)',
          }}
        />
      )}

      {/*
        The grab bar.
        This was a 24px button that only appeared on hover, which made moving a
        card a game of hunt-the-pixel. It is now a full-width strip along the
        top of every card, always visible: a card is dragged by its edge, the
        way a window is dragged by its title bar. Clicking anywhere else still
        opens the trade, which is what stops the board drifting just from being
        read.
      */}
      <div
        className="signature-drag-handle absolute inset-x-0 top-0 z-[6] flex h-7 cursor-grab
          items-center gap-1.5 px-2 active:cursor-grabbing"
        title="Drag to move"
        onClick={(event) => event.stopPropagation()}
        style={{
          background: 'linear-gradient(to bottom, rgba(10,10,12,0.62), rgba(10,10,12,0))',
        }}
      >
        <svg width="11" height="7" viewBox="0 0 11 7" fill="none" aria-hidden>
          <g fill="rgba(255,255,255,0.55)">
            <circle cx="1.4" cy="1.4" r="1" /><circle cx="5.5" cy="1.4" r="1" /><circle cx="9.6" cy="1.4" r="1" />
            <circle cx="1.4" cy="5.5" r="1" /><circle cx="5.5" cy="5.5" r="1" /><circle cx="9.6" cy="5.5" r="1" />
          </g>
        </svg>
        <span className="truncate text-[9px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {new Date(trade.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
        </span>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/screenshots/${trade.screenshot_path}`}
        alt=""
        draggable={false}
        className="absolute inset-0 size-full object-cover"
        style={{ filter: passed && dimPassed ? 'grayscale(0.55) brightness(0.72)' : 'brightness(0.86)' }}
      />

      {/* A scrim so the corner chips stay legible over any chart. Fixed black
          regardless of theme on purpose: it sits over the screenshot, not over
          the page, and chart images are dark in both themes. */}
      <div className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.12) 46%, rgba(0,0,0,0.34) 100%)' }} />

      <div
        className="absolute right-2 top-9 grid size-7 place-items-center rounded-[9px] text-[11px] font-semibold leading-none"
        style={{
          color: `rgb(${grade})`,
          background: 'rgba(10,10,12,0.6)',
          backdropFilter: 'blur(8px)',
          border: `1px solid rgb(${grade} / 0.45)`,
          boxShadow: `0 0 12px rgb(${grade} / 0.35)`,
        }}
      >
        {gradeLetter(trade.checklist_score)}
      </div>

      {/* The first mistake tag, on the card. Which error repeats is the thing
          the board is for, and it should be readable without opening anything. */}
      {trade.mistake_tags.length > 0 && (
        <span
          className="absolute left-2 top-[52px] max-w-[85%] truncate rounded-full px-2 py-0.5 text-[9px] font-medium"
          style={{
            color: 'rgb(var(--outcome-loss))',
            background: 'rgba(10,10,12,0.62)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgb(var(--outcome-loss) / 0.4)',
          }}
        >
          {trade.mistake_tags[0]}
          {trade.mistake_tags.length > 1 && ` +${trade.mistake_tags.length - 1}`}
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5">
        <div className="flex items-center gap-1.5">
          <motion.span
            transition={spring}
            className="grid size-[18px] place-items-center rounded-full text-[10px] leading-none"
            style={{
              color: `rgb(${outcome})`,
              background: `rgb(${outcome} / 0.18)`,
              border: `1px solid rgb(${outcome} / 0.4)`,
            }}
          >
            {trade.direction === 'Long' ? '▲' : '▼'}
          </motion.span>
          <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.72)' }}>
            {trade.instrument}
          </span>
        </div>

        <span className="tabular-nums text-[13px] font-semibold leading-none" style={{ color: `rgb(${outcome})` }}>
          {passed
            ? 'passed'
            : trade.r_multiple == null
              ? 'open'
              : `${trade.r_multiple > 0 ? '+' : ''}${trade.r_multiple.toFixed(1)}R`}
        </span>
      </div>
    </motion.div>
    </>
  );
}

export const TradeNode = memo(TradeNodeInner);
