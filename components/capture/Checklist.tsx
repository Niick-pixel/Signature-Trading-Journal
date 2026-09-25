'use client';

import { motion } from 'framer-motion';
import {
  CHECKLIST_PHASES, TAKE_IT_THRESHOLD, TRIGGER_KEYS,
  type ChecklistAnswer, type ChecklistKey,
} from '@/lib/domain';
import { press, spring, springBouncy } from '@/lib/motion';

interface ChecklistProps {
  answers: Record<ChecklistKey, ChecklistAnswer>;
  onChange: (key: ChecklistKey, value: ChecklistAnswer) => void;
  accent?: string;
}

/**
 * The plan's checklist, weighted exactly as written.
 *
 * Each row carries its own point value because the weights are the argument:
 * a clear sweep is worth four times a clean path, and seeing that while
 * answering is the difference between scoring a trade and rationalising one.
 */
export function Checklist({ answers, onChange, accent = 'var(--accent)' }: ChecklistProps) {
  return (
    <div className="space-y-5">
      {CHECKLIST_PHASES.map((phase) => {
        const earned = phase.items.reduce(
          (sum, i) => sum + (answers[i.key] === true ? i.points : 0), 0);
        // Out of what applied today, not out of what the plan can award.
        const possible = phase.items.reduce(
          (sum, i) => sum + (answers[i.key] === null ? 0 : i.points), 0);

        return (
          <div key={phase.phase}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.07em]"
                style={{ color: 'var(--text-faint)' }}>
                {phase.phase}
              </span>
              <motion.span
                key={earned}
                initial={{ scale: 0.8, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={springBouncy}
                className="tabular-nums text-[11px] font-semibold"
                style={{ color: earned === possible ? `rgb(${accent})` : 'var(--text-faint)' }}
              >
                {earned}/{possible}
              </motion.span>
            </div>

            {phase.note && (
              <p className="mb-2.5 text-[11px] leading-snug" style={{ color: 'var(--text-faint)' }}>
                {phase.note}
              </p>
            )}

            <div className="space-y-1.5">
              {phase.items.map((item) => {
                const on = answers[item.key] === true;
                const na = answers[item.key] === null;
                // Phase 3 is the trigger: without it there is no entry, so
                // "it did not apply" is not something that can be true of it.
                const canBeNA = !TRIGGER_KEYS.includes(item.key);
                return (
                  /*
                    The row is a container, not a button: it holds the answer
                    toggle and, where the box can be N/A, a second control for
                    it. Nesting a button inside a button is invalid, and making
                    the whole row cycle tick -> N/A -> clear would put a state
                    nobody wanted between the two they do.
                  */
                  <motion.div
                    key={item.key}
                    animate={{
                      borderColor: on ? `rgb(${accent} / 0.55)` : 'var(--glass-stroke)',
                      background: on ? `rgb(${accent} / 0.10)` : 'var(--glass-fill)',
                      boxShadow: on ? `0 0 18px rgb(${accent} / 0.20)` : '0 0 0 rgb(0 0 0 / 0)',
                      opacity: na ? 0.55 : 1,
                    }}
                    transition={spring}
                    className="flex w-full items-start gap-1 rounded-[calc(14px*var(--rk))] border pr-2 text-left"
                  >
                    <motion.button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      disabled={na}
                      onClick={() => onChange(item.key, !on)}
                      whileTap={na ? undefined : press}
                      transition={spring}
                      className="flex min-w-0 flex-1 items-start gap-3 py-2.5 pl-3.5 text-left"
                    >
                      <span className="relative mt-0.5 grid size-[17px] shrink-0 place-items-center">
                        <motion.span
                          className="absolute inset-0 rounded-[calc(5px*var(--rk))]"
                          animate={{
                            background: on ? `rgb(${accent} / 0.22)` : 'var(--glass-fill-strong)',
                            scale: on ? 1 : 0.88,
                          }}
                          transition={springBouncy}
                        />
                        <motion.svg
                          width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden className="relative"
                          style={{ color: `rgb(${accent})` }}
                          animate={{ scale: on ? 1 : 0, opacity: on ? 1 : 0 }}
                          transition={springBouncy}
                        >
                          <path d="M1 4.6L4 7.5L10 1.5" stroke="currentColor" strokeWidth="1.9"
                            strokeLinecap="round" strokeLinejoin="round" />
                        </motion.svg>
                      </span>

                      <span className="min-w-0 flex-1">
                        <span
                          className="block text-[13px] font-medium leading-snug"
                          style={{
                            color: on ? 'var(--text)' : 'var(--text-dim)',
                            textDecoration: na ? 'line-through' : undefined,
                          }}
                        >
                          {item.label}
                        </span>
                        {item.hint && (
                          <span className="mt-0.5 block text-[11px] leading-snug" style={{ color: 'var(--text-faint)' }}>
                            {item.hint}
                          </span>
                        )}
                      </span>
                    </motion.button>

                    {/*
                      Marks a condition the market never offered. Its points
                      leave the denominator rather than counting as missed, so
                      a session with no major level to sweep is graded out of
                      80 instead of capping a flawless trade at a B.
                    */}
                    {canBeNA ? (
                      <motion.button
                        type="button"
                        aria-pressed={na}
                        title={na ? 'This did apply after all' : 'This did not apply on this trade'}
                        onClick={() => onChange(item.key, na ? false : null)}
                        whileTap={press}
                        transition={spring}
                        className="mt-2.5 shrink-0 rounded-[calc(7px*var(--rk))] px-1.5 py-0.5 tabular-nums text-[11px] font-semibold"
                        style={{
                          color: na ? 'var(--text-dim)' : on ? `rgb(${accent})` : 'var(--text-faint)',
                          background: na ? 'var(--glass-fill-strong)' : 'transparent',
                          border: `1px solid ${na ? 'var(--glass-stroke)' : 'transparent'}`,
                        }}
                      >
                        {na ? 'n/a' : item.points}
                      </motion.button>
                    ) : (
                      <span
                        className="mt-2.5 shrink-0 px-1.5 py-0.5 tabular-nums text-[11px] font-semibold"
                        style={{ color: on ? `rgb(${accent})` : 'var(--text-faint)' }}
                      >
                        {item.points}
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}

      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-faint)' }}>
        Phase 3 must fire for an entry to exist. At {TAKE_IT_THRESHOLD} or more with the trigger
        fired, taking it is the rule — hesitating is a rule break, same as oversizing.
      </p>
    </div>
  );
}
