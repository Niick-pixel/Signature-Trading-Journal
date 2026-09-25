'use client';

import { motion } from 'framer-motion';
import { press, spring } from '@/lib/motion';

/**
 * A row of pills where no answer is an answer.
 *
 * Segmented always holds a value, which is right for a trade's outcome and
 * wrong for a morning question: "no bias written" must stay distinct from
 * "Neutral". Clicking the chosen pill again clears it.
 */
export function Choice<T extends string>({
  value, onChange, options, accentFor, labelFor, name,
}: {
  value: T | null;
  onChange: (value: T | null) => void;
  options: readonly T[];
  accentFor?: (option: T) => string;
  labelFor?: (option: T) => string;
  /** Names the group for screen readers and tests. */
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const on = option === value;
        const accent = accentFor?.(option) ?? 'var(--accent)';
        return (
          <motion.button
            key={option}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(on ? null : option)}
            whileTap={press}
            transition={spring}
            animate={{
              borderColor: on ? `rgb(${accent} / 0.6)` : 'var(--glass-stroke)',
              background: on ? `rgb(${accent} / 0.13)` : 'var(--glass-fill)',
              color: on ? `rgb(${accent})` : 'var(--text-dim)',
            }}
            className="flex-1 whitespace-nowrap rounded-[calc(12px*var(--rk))] border px-3 py-2 text-[12.5px] font-medium"
          >
            {labelFor?.(option) ?? option}
          </motion.button>
        );
      })}
    </div>
  );
}
