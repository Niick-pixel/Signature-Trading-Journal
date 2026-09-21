'use client';

import { useReactFlow, useStore } from '@xyflow/react';
import { motion } from 'framer-motion';
import { press, spring } from '@/lib/motion';

function ControlButton({
  label, onClick, children,
}: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={press}
      whileHover={{ y: -1 }}
      transition={spring}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-[10px]"
      style={{ color: 'var(--text-dim)' }}
    >
      {children}
    </motion.button>
  );
}

/**
 * Zoom and layout controls. A board holding a year of trades is unusable at one
 * fixed scale, and scroll-wheel zoom alone is not discoverable.
 */
export function BoardControls({ onRecluster }: { onRecluster: () => void }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);

  return (
    <div className="glass pointer-events-auto flex items-center gap-0.5 rounded-[14px] p-1">
      <ControlButton label="Zoom out" onClick={() => zoomOut({ duration: 220 })}>
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="9" cy="9" r="5.6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6.6 9h4.8M13.2 13.2L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </ControlButton>

      <button
        type="button"
        onClick={() => fitView({ padding: 0.08, duration: 320 })}
        title="Fit every trade on screen"
        className="min-w-[3.1rem] rounded-[10px] px-1 py-1 text-center tabular-nums text-[11px] font-medium"
        style={{ color: 'var(--text-dim)' }}
      >
        {Math.round(zoom * 100)}%
      </button>

      <ControlButton label="Zoom in" onClick={() => zoomIn({ duration: 220 })}>
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="9" cy="9" r="5.6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6.6 9h4.8M9 6.6v4.8M13.2 13.2L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </ControlButton>

      <span className="mx-1 h-5 w-px" style={{ background: 'var(--glass-stroke)' }} />

      <ControlButton label="Fit to screen" onClick={() => fitView({ padding: 0.08, duration: 320 })}>
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M3 7.5V3h4.5M16.5 7.5V3H12M3 12.5V17h4.5M16.5 12.5V17H12"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </ControlButton>

      <ControlButton label="Re-order the board" onClick={onRecluster}>
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M4 6.5h8.5M4 13.5h8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M14 4.5l2.4 2-2.4 2M14 11.5l2.4 2-2.4 2"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </ControlButton>
    </div>
  );
}
