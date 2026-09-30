'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { press, spring } from '@/lib/motion';
import { usePrepProgress } from './SessionPrep';

/**
 * The chart prep in the title bar: an invitation until started, progress
 * while it is going, and the day's map once done — one click from anywhere.
 */
export function PrepChip() {
  const progress = usePrepProgress();
  const path = usePathname();
  if (!progress || path?.startsWith('/prep')) return null;
  const { label, state } = progress;
  return (
    <motion.div whileTap={press} whileHover={{ y: -1 }} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
      <Link href="/prep" data-prep-chip={state}
        title={state === 'done' ? "Today's map and plans (P)" : 'The chart prep before New York (P)'}
        className="flex items-center gap-2 rounded-full border px-3 py-1 text-[11.5px] font-medium"
        style={{
          borderColor: state === 'todo' ? 'rgb(var(--accent) / 0.45)' : 'var(--glass-stroke)',
          background: state === 'todo' ? 'rgb(var(--accent) / 0.1)' : 'var(--glass-fill)',
          color: state === 'todo' ? 'rgb(var(--accent))' : 'var(--text-dim)',
        }}>
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden
          style={{ color: state === 'done' ? 'rgb(var(--outcome-win))' : 'currentColor' }}>
          <path d="M3 5h14M3 10h9M3 15h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {label}
      </Link>
    </motion.div>
  );
}
