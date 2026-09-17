'use client';

import { motion } from 'framer-motion';
import { press, spring } from '@/lib/motion';

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly T[];
  /** Per-option colour, e.g. outcome hues. */
  accentFor?: (option: T) => string;
  labelFor?: (option: T) => string;
  /** Hover text per option, for the places where the label alone is cryptic. */
  titleFor?: (option: T) => string;
}

/**
 * A row of choices, all visible at once. Used where the answer is already known
 * and a dropdown would just hide it behind a click — the trade's outcome, most
 * of all, which you know before you start writing anything down.
 */
export function Segmented<T extends string>({
  value, onChange, options, accentFor, labelFor, titleFor,
}: SegmentedProps<T>) {
  return (
    <div className="glass flex flex-wrap gap-1 rounded-[16px] p-1">
      {options.map((option) => {
        const active = option === value;
        const accent = accentFor?.(option) ?? 'var(--accent)';
        return (
          <motion.button
            key={option}
            type="button"
            title={titleFor?.(option)}
            onClick={() => onChange(option)}
            whileTap={press}
            animate={{
              background: active ? `rgb(${accent} / 0.16)` : `rgb(${accent} / 0)`,
              color: active ? `rgb(${accent})` : 'var(--text-dim)',
              borderColor: active ? `rgb(${accent} / 0.5)` : 'rgba(0,0,0,0)',
              boxShadow: active ? `0 0 18px rgb(${accent} / 0.22)` : '0 0 0 rgb(0 0 0 / 0)',
            }}
            transition={spring}
            className="flex-1 rounded-[12px] border px-3 py-2 text-[12px] font-medium whitespace-nowrap"
          >
            {labelFor?.(option) ?? option}
          </motion.button>
        );
      })}
    </div>
  );
}
