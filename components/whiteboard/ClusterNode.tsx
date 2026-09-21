'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { gradeLetter } from '@/lib/grade';
import { springLayout } from '@/lib/motion';
import type { PositionedCluster } from '@/lib/layout';

export type ClusterNodeData = { cluster: PositionedCluster; accent: string; index: number };

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-[0.09em]" style={{ color: 'var(--text-faint)' }}>
        {label}
      </span>
      <span className="tabular-nums text-[13px] font-semibold leading-none" style={{ color: tone ?? 'var(--text)' }}>
        {value}
      </span>
    </div>
  );
}

/**
 * A labelled region with a soft glowing halo in its reason's hue.
 *
 * The header is the point of the whole screen: count, win rate, total R and
 * average grade, live. If the FOMO cluster reads -8.4R, that number is in your
 * face every time the app opens.
 */
function ClusterNodeInner({ data }: NodeProps) {
  const { cluster, accent, index } = data as unknown as ClusterNodeData;
  const { stats } = cluster;

  const rTone = stats.totalR > 0 ? 'var(--outcome-win)' : stats.totalR < 0 ? 'var(--outcome-loss)' : null;

  return (
    <motion.div
      layout
      // Regions settle in worst-first, which is also the order you should read
      // them. The trade nodes deliberately have no entrance of their own: they
      // share a layoutId with the detail panel, and a competing initial state
      // breaks that transition.
      initial={{ opacity: 0, scale: 0.97, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ ...springLayout, delay: Math.min(index, 8) * 0.045 }}
      style={{
        width: cluster.width,
        height: cluster.height,
        borderColor: `rgb(${accent} / var(--cluster-stroke))`,
        background: `radial-gradient(120% 90% at 50% 0%, rgb(${accent} / var(--cluster-tint)), rgb(${accent} / var(--cluster-tint-edge)) 60%, transparent)`,
        boxShadow: `0 0 70px -12px rgb(${accent} / var(--cluster-glow)), inset 0 1px 0 rgb(${accent} / 0.22)`,
      }}
      className="pointer-events-none rounded-[30px] border backdrop-blur-[2px]"
    >
      {/*
        Two rows, not one. Sharing a row meant the stats squeezed the reason
        label until it truncated to an ellipsis — and the label is the single
        most important word on the region. Now neither can crowd the other.
      */}
      <div
        className="signature-cluster-handle pointer-events-auto cursor-grab px-7 pt-4 active:cursor-grabbing"
        title="Drag to move the whole group"
      >
        <div className="flex items-center gap-2">
          <span className="size-2 shrink-0 rounded-full"
            style={{ background: `rgb(${accent})`, boxShadow: `0 0 10px rgb(${accent})` }} />
          <h2 className="text-[14px] font-semibold tracking-tight" style={{ color: `rgb(${accent})` }}>
            {cluster.key}
          </h2>
        </div>

        <div className="mt-2.5 flex flex-wrap items-end gap-x-5 gap-y-2">
          <Stat label="Trades" value={String(stats.count)} />
          <Stat label="Win rate" value={stats.winRate == null ? '—' : `${Math.round(stats.winRate * 100)}%`} />
          <Stat
            label="Total R"
            value={`${stats.totalR > 0 ? '+' : ''}${stats.totalR.toFixed(1)}R`}
            tone={rTone ? `rgb(${rTone})` : undefined}
          />
          <Stat
            label="Avg grade"
            value={stats.avgGrade == null ? '—' : gradeLetter(Math.round(stats.avgGrade))}
          />
          {stats.passed > 0 && <Stat label="Passed" value={String(stats.passed)} />}
        </div>
      </div>

      {/*
        The anchor for the branch line from the board title.

        Handle was imported here from the start and never actually rendered,
        so React Flow had nowhere to land those edges and dropped every one of
        them: the tree the board is described as drawing has never been on the
        screen. Invisible, and out of the way of the drag handle above.
      */}
      <Handle type="target" position={Position.Top}
        style={{ opacity: 0, pointerEvents: 'none' }} />
    </motion.div>
  );
}

export const ClusterNode = memo(ClusterNodeInner);
