'use client';

import { motion } from 'framer-motion';
import { press, spring } from '@/lib/motion';
import type { Tri } from '@/lib/domain';

const OPTIONS: Array<{ value: Tri; label: string; accent: string | null }> = [
  { value: null, label: 'Unset', accent: null },
  { value: true, label: 'Yes', accent: 'var(--outcome-win)' },
  { value: false, label: 'No', accent: 'var(--outcome-loss)' },
];

interface TriStateProps {
  value: Tri;
  onChange: (v: Tri) => void;
  label: string;
  hint?: string;
}

/**
 * Three states, because two of them were a lie.
 *
 * This replaced a checkbox that defaulted to on, which meant every trade ever
 * saved claimed full rule adherence whether or not the question had been
 * looked at. Unanswered is now a state you can see, it is where every trade
 * starts, and it is visibly not the same as "yes" — grey outline unset, green
 * yes, red no.
 */
export function TriState({ value, onChange, label, hint }: TriStateProps) {
  return (
    <div>
      <div className="mb-2">
        <span className="block text-[13px] font-medium leading-snug">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-[11px] leading-snug" style={{ color: 'var(--text-faint)' }}>
            {hint}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        {OPTIONS.map((opt) => {
          const on = value === opt.value;
          const accent = opt.accent;
          return (
            <motion.button
              key={opt.label}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(opt.value)}
              whileTap={press}
              animate={{
                borderColor: on
                  ? (accent ? `rgb(${accent} / 0.6)` : 'var(--glass-stroke-strong, var(--glass-stroke))')
                  : 'var(--glass-stroke)',
                background: on
                  ? (accent ? `rgb(${accent} / 0.12)` : 'var(--glass-fill-strong)')
                  : 'var(--glass-fill)',
                boxShadow: on && accent ? `0 0 16px rgb(${accent} / 0.22)` : '0 0 0 rgb(0 0 0 / 0)',
              }}
              transition={spring}
              className="flex-1 rounded-[calc(12px*var(--rk))] border px-3 py-2 text-[12px] font-medium"
              style={{
                color: on
                  ? (accent ? `rgb(${accent})` : 'var(--text)')
                  : 'var(--text-faint)',
              }}
            >
              {opt.label}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
