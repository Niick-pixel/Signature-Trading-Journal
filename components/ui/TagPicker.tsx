'use client';

import { motion } from 'framer-motion';
import { press, spring } from '@/lib/motion';
import { MISTAKE_TAGS } from '@/lib/domain';

interface TagPickerProps<T extends string> {
  value: T[];
  onChange: (v: T[]) => void;
  /** Mistakes by default. What worked passes WORKED_TAGS and the win tone. */
  options?: readonly T[];
  /** loss: what went wrong; win: what worked; market: what the market did. */
  tone?: 'loss' | 'win' | 'market';
  /** Names the group for screen readers and tests. */
  name?: string;
}

/**
 * Multi-select, because a bad trade usually has three.
 *
 * A single dropdown forced one mistake to stand for the whole story — "entered
 * late" and "chased" and "oversized" are one event, and picking one of them
 * throws the other two away along with the pattern they would have shown.
 */
export function TagPicker<T extends string>({
  value, onChange, options = MISTAKE_TAGS as unknown as readonly T[], tone = 'loss', name, small = false,
}: TagPickerProps<T> & { small?: boolean }) {
  const toggle = (tag: T) =>
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]);
  const hue = tone === 'win' ? 'var(--outcome-win)' : tone === 'market' ? 'var(--amber)' : 'var(--outcome-loss)';

  return (
    // Named only when asked: inside a Field group the field already names it.
    <div className={`flex flex-wrap ${small ? 'gap-1.5' : 'gap-2'}`} {...(name ? { role: 'group', 'aria-label': name } : {})}>
      {options.map((tag) => {
        const on = value.includes(tag);
        return (
          <motion.button
      initial={false}
            key={tag}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(tag)}
            whileTap={press}
            animate={{
              borderColor: on ? `rgb(${hue} / 0.55)` : 'var(--glass-stroke)',
              background: on ? `rgb(${hue} / 0.12)` : 'var(--glass-fill)',
              boxShadow: on ? `0 0 14px rgb(${hue} / 0.20)` : '0 0 0 rgb(0 0 0 / 0)',
            }}
            transition={spring}
            className={`rounded-full border font-medium ${small ? 'px-2.5 py-1 text-[11.5px]' : 'px-3 py-1.5 text-[12px]'}`}
            style={{ color: on ? `rgb(${hue})` : 'var(--text-dim)' }}
          >
            {tag}
          </motion.button>
        );
      })}
    </div>
  );
}
