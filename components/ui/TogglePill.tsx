'use client';

import { motion } from 'framer-motion';
import { press, spring, springBouncy } from '@/lib/motion';

interface TogglePillProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  /** 'r g b' triple for the on-state colour shift. */
  accent?: string;
}

/** A pill, not a checkbox. Springs and shifts colour when it comes on. */
export function TogglePill({ checked, onChange, label, hint, accent = 'var(--grade-aplus)' }: TogglePillProps) {
  return (
    <motion.button
      initial={false}
      type="button"
      role="switch"
      aria-checked={checked}
      title={hint}
      onClick={() => onChange(!checked)}
      whileTap={press}
      whileHover={{ y: -1 }}
      animate={{
        borderColor: checked ? `rgb(${accent} / 0.6)` : 'var(--glass-stroke)',
        boxShadow: checked
          ? `var(--shadow-card), 0 0 20px rgb(${accent} / 0.30)`
          : 'var(--shadow-card), 0 0 0px rgb(0 0 0 / 0)',
        color: checked ? `rgb(${accent})` : 'var(--text-dim)',
      }}
      transition={spring}
      className="glass flex items-center gap-2.5 rounded-full py-2.5 pl-3 pr-4 text-[13px] font-medium"
    >
      <span className="relative grid size-[18px] shrink-0 place-items-center">
        <motion.span
          className="absolute inset-0 rounded-full"
          animate={{
            // White at 6% is invisible on a light glass surface; the token
            // resolves per theme.
            background: checked ? `rgb(${accent} / 0.22)` : 'var(--glass-fill-strong)',
            scale: checked ? 1 : 0.85,
          }}
          transition={springBouncy}
        />
        <motion.svg
      initial={false}
          width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden className="relative"
          animate={{ scale: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={springBouncy}
        >
          <path d="M1 4.6L4 7.5L10 1.5" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
      </span>
      <span className="text-left leading-tight">{label}</span>
    </motion.button>
  );
}
