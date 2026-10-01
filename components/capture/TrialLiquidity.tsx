'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Select } from '@/components/ui/Select';
import { TriState } from '@/components/ui/TriState';
import { GRADE_COLOR } from '@/lib/grade';
import type { SweepTier, Tri } from '@/lib/domain';
import {
  HTF_DELIVERIES, SWEEP_LEVELS, TRIAL_RUBRIC, effectiveSweep, gradeUnder, liquidityEvent,
  type GradeInput, type LiquidityEvent,
} from '@/lib/rubric';
import { springSoft } from '@/lib/motion';

const NOT_NAMED = 'Not named';
const NO_DELIVERY = 'No delivery';

const EVENT_LABEL: Record<LiquidityEvent, string> = {
  both: 'Sweep + delivery',
  sweep: 'Sweep only',
  delivery: 'Delivery only',
  none: 'No named liquidity event',
};

interface TrialLiquidityProps {
  /** Everything rubric 4 reads: the checklist answers plus the three below. */
  answers: GradeInput;
  sweepTier: SweepTier | null;
  sweepLevel: string;
  onSweepLevel: (v: string) => void;
  futuresConfirmed: Tri;
  onFuturesConfirmed: (v: Tri) => void;
  htfDelivery: string;
  onHtfDelivery: (v: string) => void;
  accent?: string;
}

/**
 * Rubric 4, on trial — the liquidity event, named.
 *
 * Shown beside the checklist, never instead of it: the grade this trade is
 * taken and frozen on is still the current rubric's. What this panel adds is
 * the evidence for the rule being tested — which level the sweep took,
 * whether it also happened on NQ futures, and which higher-timeframe FVG/OB
 * price delivered from — and the grade rubric 4 would give, so the two can be
 * compared trade by trade in Stats before rubric 4 is ever allowed to count.
 *
 * All picked, nothing typed: naming the level is the rule; the price itself
 * belongs on the chart.
 */
export function TrialLiquidity({
  answers, sweepTier, sweepLevel, onSweepLevel, futuresConfirmed, onFuturesConfirmed,
  htfDelivery, onHtfDelivery, accent = 'var(--accent)',
}: TrialLiquidityProps) {
  if (TRIAL_RUBRIC == null) return null;

  const swept = sweepTier === 'major' || sweepTier === 'minor';
  const trial = gradeUnder(TRIAL_RUBRIC, answers);
  const event = liquidityEvent(answers);
  // Why a sweep the checklist credits is not credited here — said, not implied.
  const dropped = swept && effectiveSweep(answers) === 'none'
    ? !sweepLevel.trim()
      ? 'Pick the level, or rubric 4 counts no sweep.'
      : 'A minor sweep needs NQ futures confirmation, or rubric 4 counts no sweep.'
    : null;

  return (
    <section data-trial-rubric={TRIAL_RUBRIC} aria-label={`Rubric ${TRIAL_RUBRIC} trial`}
      className="mt-6 rounded-[calc(16px*var(--rk))] border border-dashed px-4 pb-4 pt-3.5"
      style={{ borderColor: `rgb(${accent} / 0.35)`, background: 'var(--glass-fill)' }}>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.07em]" style={{ color: 'var(--text-faint)' }}>
          Liquidity event · rubric {TRIAL_RUBRIC} trial
        </span>
        <span data-trial-letter={trial.letter} className="tabular-nums text-[12px] font-bold"
          title="What rubric 4 would grade these answers. Not saved as the grade."
          style={{ color: `rgb(${GRADE_COLOR[trial.letter]})` }}>
          {trial.letter} · {trial.score}%
        </span>
      </div>
      <p className="mb-3 text-[11px] leading-snug" style={{ color: 'var(--text-faint)' }}>
        Logged for the trial only. The grade above is still the one this trade is taken on.
      </p>

      <div className="space-y-3">
        {swept && (
          <div className="space-y-3">
            <div data-field="sweep_level">
              <span className="mb-1.5 block text-[12.5px] font-medium">Which level was swept?</span>
              <Select accent={accent} value={sweepLevel || null} placeholder="Pick the level…"
                options={[NOT_NAMED, ...SWEEP_LEVELS]}
                onChange={(v) => onSweepLevel(v === NOT_NAMED ? '' : v)} />
              <span className="mt-1 block text-[11px] leading-snug" style={{ color: 'var(--text-faint)' }}>
                If none of these fits, there was no sweep.
              </span>
            </div>
            <TriState value={futuresConfirmed} onChange={onFuturesConfirmed}
              label="Sweep confirmed on NQ futures"
              hint="Checked on real CME data, not just the CFD wick. Required for a MINOR sweep." />
          </div>
        )}

        <div data-field="htf_delivery">
          <span className="mb-1.5 block text-[12.5px] font-medium">Delivered from an HTF FVG / OB?</span>
          <Select accent={accent} value={htfDelivery || null} placeholder="Pick one, or No delivery…"
            options={[NO_DELIVERY, ...HTF_DELIVERIES]}
            onChange={(v) => onHtfDelivery(v === NO_DELIVERY ? '' : v)} />
          <span className="mt-1 block text-[11px] leading-snug" style={{ color: 'var(--text-faint)' }}>
            Only if the bodies respected it. Delivery alone caps at B; A+ needs it with a sweep.
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px]">
        <span data-trial-event={event} className="rounded-full border px-2.5 py-0.5 font-semibold"
          style={{
            borderColor: event === 'none' ? 'rgb(var(--outcome-loss) / 0.45)' : `rgb(${accent} / 0.45)`,
            color: event === 'none' ? 'rgb(var(--outcome-loss))' : `rgb(${accent})`,
          }}>
          {EVENT_LABEL[event]}
        </span>
      </div>

      <AnimatePresence initial={false}>
        {(dropped || trial.caps.length > 0) && (
          <motion.ul key="caps" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={springSoft} className="mt-2 space-y-0.5 text-[11.5px] leading-snug">
            {dropped && <li data-trial-dropped style={{ color: 'rgb(var(--amber))' }}>{dropped}</li>}
            {trial.caps.map((c) => (
              <li key={c.id} data-trial-cap={c.id}
                style={{ color: c.id === 'model' ? 'rgb(var(--outcome-loss))' : 'var(--text-dim)' }}>
                {c.message}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </section>
  );
}
