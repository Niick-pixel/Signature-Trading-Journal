'use client';

import { motion } from 'framer-motion';
import { press, spring } from '@/lib/motion';
import { Field } from '@/components/ui/Field';

/** 1 to 5, click again to clear. Shared by the daily review and the morning check-in. */
export function Scale({ value, onChange, label, hint }: {
  value: number | null; onChange: (v: number | null) => void; label: string; hint?: string;
}) {
  return (
    <Field label={label} hint={hint} group>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <motion.button
            key={n}
            type="button"
            aria-pressed={value === n}
            onClick={() => onChange(value === n ? null : n)}
            whileTap={press}
            transition={spring}
            animate={{
              borderColor: value === n ? 'rgb(var(--accent) / 0.6)' : 'var(--glass-stroke)',
              background: value === n ? 'rgb(var(--accent) / 0.12)' : 'var(--glass-fill)',
            }}
            className="flex-1 rounded-[calc(12px*var(--rk))] border py-2 text-[13px] font-medium"
            style={{ color: value === n ? 'rgb(var(--accent))' : 'var(--text-faint)' }}
          >
            {n}
          </motion.button>
        ))}
      </div>
    </Field>
  );
}
