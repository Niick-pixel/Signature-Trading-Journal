'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  GRADE_COLOR, gradeLetter, isBelowStandard,
  BELOW_STANDARD_PROMPT, NO_TRIGGER_PROMPT,
} from '@/lib/grade';
import { spring, springBouncy } from '@/lib/motion';

const AMBER = 'var(--amber)';

interface GradeBadgeProps {
  /** Points earned. */
  total: number;
  /**
   * Points that were on the table for THIS trade, not the plan's fixed 100.
   *
   * A box marked "did not apply" takes its weight out of the denominator, so a
   * session with no major level to sweep is graded out of 80. The letter comes
   * from the percentage of what applied; the caption shows the raw fraction so
   * the smaller denominator is visible rather than silently assumed.
   */
  max: number;
  /** 'lg' is the live badge in the capture form; 'sm' rides in a node corner. */
  size?: 'sm' | 'md' | 'lg';
  /** Show the nudge when the score is under 70 or Phase 3 hasn't fired. */
  showPrompt?: boolean;
  /**
   * Both Phase 3 answers. The plan is explicit that without them there is no
   * entry at all, so this outranks the score: a 85-point setup with no
   * inversion close is still not a trade.
   */
  triggerFired?: boolean;
}

/** Letter big, number small. Glows in its grade colour. */
export function GradeBadge({
  total, max, size = 'md', showPrompt = false, triggerFired = true,
}: GradeBadgeProps) {
  const pct = max > 0 ? Math.round((total * 100) / max) : 0;
  const letter = gradeLetter(pct);
  const below = isBelowStandard(pct);
  // No trigger is the louder problem, so it wins the one line we show.
  const prompt = !triggerFired ? NO_TRIGGER_PROMPT : below ? BELOW_STANDARD_PROMPT : null;
  // Off-plan, the badge goes amber regardless of the letter's own colour.
  const color = prompt && showPrompt ? AMBER : GRADE_COLOR[letter];

  const dims = {
    sm: { box: 'size-9 rounded-[calc(11px*var(--rk))]', letter: 'text-[13px]', num: 'text-[8px]' },
    md: { box: 'size-12 rounded-[calc(14px*var(--rk))]', letter: 'text-lg', num: 'text-[9px]' },
    lg: { box: 'size-20 rounded-[calc(20px*var(--rk))]', letter: 'text-[34px]', num: 'text-[11px]' },
  }[size];

  return (
    <div className="flex items-center gap-3.5">
      <motion.div
        // Re-keying on the letter makes the badge pop each time the grade
        // actually changes, not on every slider tick.
        key={letter}
        initial={{ scale: 0.72 }}
        animate={{ scale: 1 }}
        transition={springBouncy}
        className={`glass grid shrink-0 place-items-center leading-none ${dims.box}`}
        style={{
          borderColor: `rgb(${color} / 0.5)`,
          boxShadow: `var(--shadow-card), 0 0 24px rgb(${color} / 0.35)`,
          color: `rgb(${color})`,
        }}
      >
        <span className={`font-semibold tracking-tight ${dims.letter}`}>{letter}</span>
        <span className={`mt-0.5 tabular-nums ${dims.num}`} style={{ color: 'var(--text-faint)' }}>
          {total}/{max}
        </span>
        {max > 0 && max < 100 && (
          <span className={`tabular-nums ${dims.num}`} style={{ color: 'var(--text-faint)' }}>
            {pct}%
          </span>
        )}
      </motion.div>

      <AnimatePresence>
        {showPrompt && prompt && (
          <motion.p
            key={prompt}
            initial={{ opacity: 0, x: -8, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -6, scale: 0.98 }}
            transition={spring}
            className="max-w-[19rem] text-[13px] font-medium leading-snug"
            style={{ color: `rgb(${AMBER})` }}
          >
            {prompt}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
