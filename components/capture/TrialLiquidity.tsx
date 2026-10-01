'use client';

import { Select } from '@/components/ui/Select';
import { TriState } from '@/components/ui/TriState';
import { GRADE_COLOR } from '@/lib/grade';
import type { SweepTier, Tri } from '@/lib/domain';
import {
  HTF_DELIVERIES, SWEEP_LEVELS, TRIAL_RUBRIC, effectiveSweep, gradeUnder, liquidityEvent,
  type GradeInput, type LiquidityEvent,
} from '@/lib/rubric';

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
      className="mt-4 rounded-[calc(14px*var(--rk))] border border-dashed px-3 pb-3 pt-2.5"
      style={{ borderColor: `rgb(${accent} / 0.35)`, background: 'var(--glass-fill)' }}>
      <div className="mb-2 flex items-baseline justify-between gap-3"
        title="Logged for the trial only. The grade above is still the one this trade is taken on.">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.07em]" style={{ color: 'var(--text-faint)' }}>
          Liquidity event · rubric {TRIAL_RUBRIC} trial <span aria-hidden className="normal-case opacity-60">ⓘ</span>
        </span>
        <span data-trial-letter={trial.letter} className="tabular-nums text-[12px] font-bold"
          title="What rubric 4 would grade these answers. Not saved as the grade."
          style={{ color: `rgb(${GRADE_COLOR[trial.letter]})` }}>
          {trial.letter} · {trial.score}%
        </span>
      </div>

      <div className={`grid gap-2 ${swept ? 'grid-cols-2' : ''}`}>
        {swept && (
          <div data-field="sweep_level" title="If none of these fits, there was no sweep.">
            <span className="mb-1 block text-[11.5px] font-medium">Level swept</span>
            <Select accent={accent} value={sweepLevel || null} placeholder="Pick…"
              options={[NOT_NAMED, ...SWEEP_LEVELS]}
              onChange={(v) => onSweepLevel(v === NOT_NAMED ? '' : v)} />
          </div>
        )}
        <div data-field="htf_delivery" title="Only if the bodies respected it. Delivery alone caps at B; A+ needs it with a sweep.">
          <span className="mb-1 block text-[11.5px] font-medium">HTF delivery</span>
          <Select accent={accent} value={htfDelivery || null} placeholder="Pick, or none…"
            options={[NO_DELIVERY, ...HTF_DELIVERIES]}
            onChange={(v) => onHtfDelivery(v === NO_DELIVERY ? '' : v)} />
        </div>
      </div>
      {swept && (
        <div className="mt-2">
          <TriState inline value={futuresConfirmed} onChange={onFuturesConfirmed}
            label="Sweep on NQ futures"
            hint="Checked on real CME data, not just the CFD wick. Required for a MINOR sweep." />
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
        <span data-trial-event={event} className="rounded-full border px-2.5 py-0.5 font-semibold"
          style={{
            borderColor: event === 'none' ? 'rgb(var(--outcome-loss) / 0.45)' : `rgb(${accent} / 0.45)`,
            color: event === 'none' ? 'rgb(var(--outcome-loss))' : `rgb(${accent})`,
          }}>
          {EVENT_LABEL[event]}
        </span>
      </div>

      {/* One line: the reason that matters most; the rest in its tooltip. */}
      {(dropped || trial.caps.length > 0) && (
        <p data-trial-cap={trial.caps[0]?.id ?? 'dropped'} className="mt-1.5 truncate text-[11px] leading-snug"
          title={[dropped, ...trial.caps.map((c) => c.message)].filter(Boolean).join('\n')}
          style={{ color: dropped ? 'rgb(var(--amber))' : trial.caps[0]?.id === 'model' ? 'rgb(var(--outcome-loss))' : 'var(--text-dim)' }}>
          {dropped ?? trial.caps[0].message}
        </p>
      )}
    </section>
  );
}
