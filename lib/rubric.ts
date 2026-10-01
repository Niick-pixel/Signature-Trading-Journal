import {
  TRIGGER_KEYS, type ChecklistAnswer, type ChecklistKey, type LegacyChecklistKey, type SweepTier,
} from './domain';
import { GRADE_LETTERS, type GradeLetter } from './grade';

/**
 * The grading rubric, versioned, so history cannot re-grade itself.
 *
 * The schema's checklist_score, trigger_fired and grade_letter are generated
 * columns: they follow whatever weights and thresholds are current, on every
 * read. Change one weight and every trade ever logged silently takes a new
 * grade under a rule that did not exist when it was taken. So each trade
 * records the rubric version it was graded under, and a frozen snapshot of the
 * grade that rubric gave it (score_at_entry, letter_at_entry,
 * trigger_fired_at_entry). Stats, charts and the board read the snapshot.
 *
 * Every version is written out as literal numbers — never derived from
 * CHECKLIST_PHASES — so editing the live checklist can never move an old
 * version. To change a weight or a letter band: add a version here, raise
 * CURRENT_RUBRIC, update the checklist and the generated columns to match, and
 * record it in db/RUBRIC.md. The test suite fails if the live checklist and
 * the current version disagree.
 */

type BoxKey = ChecklistKey | LegacyChecklistKey;

/** Everything a rubric can read off a trade: its boxes, its sweep tier, its target. */
export type GradeInput = Partial<Record<BoxKey, ChecklistAnswer>> & {
  sweep_tier?: SweepTier | null;
  target_type?: string | null;
  /** Rubric 4: the swept level, picked. A sweep nobody can name is no sweep. */
  sweep_level?: string | null;
  /** Rubric 4: the sweep also happened on NQ futures, not just the CFD wick. */
  sweep_futures_confirmed?: boolean | null;
  /** Rubric 4: the HTF array price delivered from, picked. Non-empty = delivered. */
  htf_delivery?: string | null;
};

/**
 * A cap on the letter, whatever the total. Rubric 2's gates: a trade can score
 * 95 on the rest of the checklist and still not be the model.
 */
export interface GradeCap {
  id: 'model' | 'diagonal' | 'delivery' | 'aplus';
  /** The best letter a trade that trips this can have. */
  max: GradeLetter;
  message: string;
  applies: (a: GradeInput) => boolean;
}

export const MODEL_GATE_MESSAGE = 'Gate failed — this is not the model. Max grade C.';
export const DIAGONAL_CAP_MESSAGE = 'Trendline/diagonal target — max grade B.';
export const LIQUIDITY_GATE_MESSAGE = 'Gate failed — no named liquidity event, or not a single gap. Max grade C.';
export const DELIVERY_CAP_MESSAGE = 'Delivery only, no sweep — max grade B.';
export const APLUS_CAP_MESSAGE = 'A+ needs a named sweep AND a delivery from an HTF FVG/OB — max grade A.';

/**
 * Rubric 4's liquidity event: why there is a counterparty for size here.
 *
 * A sweep supplies stop orders; a delivery into a higher-timeframe FVG/OB
 * supplies resting limit orders. Either is a reason for price to turn. A
 * sweep only counts when the level is named, and a MINOR sweep only counts
 * when it also happened on NQ futures — a two-point CFD wick past a level is
 * not a sweep of the stops that sit on the real exchange.
 */
export type LiquidityEvent = 'both' | 'sweep' | 'delivery' | 'none';

/**
 * What can be named as the swept level — picked, not typed. Naming it is what
 * the rule asks; the price itself lives on the chart.
 */
export const SWEEP_LEVELS = [
  'PDH', 'PDL', 'PWH', 'PWL',
  'Asia high', 'Asia low', 'London high', 'London low',
  'EQH', 'EQL', 'Intraday high', 'Intraday low', 'Data wick (ITH/ITL)',
] as const;

/** The higher-timeframe array price delivered from: timeframe and kind, picked. */
export const DELIVERY_TIMEFRAMES = ['5m', '15m', '1H', '4H', 'Daily'] as const;
export const DELIVERY_KINDS = ['FVG', 'OB'] as const;
export const HTF_DELIVERIES = DELIVERY_TIMEFRAMES.flatMap((tf) => DELIVERY_KINDS.map((k) => `${tf} ${k}`));

const named = (v: string | null | undefined) => typeof v === 'string' && v.trim().length > 0;

/** The sweep tier rubric 4 actually credits, after its naming and futures rules. */
export function effectiveSweep(a: GradeInput): SweepTier {
  const tier = a.sweep_tier ?? 'none';
  if (tier === 'none' || !named(a.sweep_level)) return 'none';
  if (tier === 'minor' && a.sweep_futures_confirmed !== true) return 'none';
  return tier;
}

/**
 * The liquidity event the trial sees on a stored trade — or 'unrecorded' for
 * one logged before the trial asked, which must not be read as "none".
 */
export function trialEventOf(a: GradeInput): LiquidityEvent | 'unrecorded' {
  const asked = a.sweep_level != null || a.htf_delivery != null || a.sweep_futures_confirmed != null;
  return asked ? liquidityEvent(a) : 'unrecorded';
}

export function liquidityEvent(a: GradeInput): LiquidityEvent {
  const sweep = effectiveSweep(a) !== 'none';
  const delivery = named(a.htf_delivery);
  return sweep && delivery ? 'both' : sweep ? 'sweep' : delivery ? 'delivery' : 'none';
}

export interface Rubric {
  version: number;
  /** When it came into force, for db/RUBRIC.md. */
  since: string;
  /** Points per yes/no box. A box missing here is not part of this rubric. */
  weights: Partial<Record<BoxKey, number>>;
  /** Points per sweep tier, when the rubric grades the sweep as a tier. */
  sweep?: Record<SweepTier, number>;
  /**
   * Points for the liquidity event, when the rubric grades it instead of the
   * bare sweep tier (rubric 4). A sweep scores by its effective tier; a
   * delivery alone scores `delivery`; both together score `both`.
   */
  liquidity?: { sweep: Record<SweepTier, number>; delivery: number; both: number };
  /** On trial: graded beside the current rubric, never frozen onto a trade. */
  trial?: boolean;
  /** Boxes that can never be N/A: an unanswered one counts as a no. */
  required?: readonly BoxKey[];
  /** Lowest score for each letter, best first. */
  letters: ReadonlyArray<readonly [number, GradeLetter]>;
  caps?: readonly GradeCap[];
}

export const RUBRICS: Record<number, Rubric> = {
  1: {
    version: 1,
    since: '2026-09-10',
    weights: {
      chk_htf_bias: 10, chk_killzone: 10, chk_no_news: 5,
      chk_sweep: 20, chk_displacement_fvg: 15, chk_targets_clear: 15, chk_clean_path: 5,
      chk_returned_to_fvg: 5, chk_inversion_close: 15,
    },
    letters: [[90, 'A+'], [80, 'A'], [70, 'B'], [50, 'C'], [0, 'F']],
  },
  2: {
    version: 2,
    since: '2026-09-29',
    weights: {
      chk_htf_bias: 10, chk_killzone: 10, chk_no_news: 5,
      singular_gap: 10, chk_displacement_fvg: 10, chk_targets_clear: 10, chk_clean_path: 5,
      chk_returned_to_fvg: 5, chk_inversion_close: 15,
    },
    sweep: { major: 20, minor: 12, none: 0 },
    required: ['singular_gap', 'chk_returned_to_fvg', 'chk_inversion_close'],
    letters: [[90, 'A+'], [80, 'A'], [70, 'B'], [50, 'C'], [0, 'F']],
    caps: [
      {
        id: 'model', max: 'C', message: MODEL_GATE_MESSAGE,
        // Unanswered is not passed: a gate nobody looked at has not been cleared.
        applies: (a) => (a.sweep_tier ?? 'none') === 'none' || a.singular_gap !== true,
      },
      {
        id: 'diagonal', max: 'B', message: DIAGONAL_CAP_MESSAGE,
        applies: (a) => a.target_type === 'Trendline/diagonal',
      },
    ],
  },
  3: {
    version: 3,
    since: '2026-09-29',
    weights: {
      chk_htf_bias: 10, chk_killzone: 10, chk_no_news: 5,
      singular_gap: 10, chk_displacement_fvg: 10, chk_targets_clear: 10, chk_clean_path: 5,
      chk_returned_to_fvg: 5, chk_inversion_close: 15,
    },
    sweep: { major: 20, minor: 12, none: 0 },
    required: ['singular_gap', 'chk_returned_to_fvg', 'chk_inversion_close'],
    // A+ is a perfect trade and nothing less: 100% of what applied.
    letters: [[100, 'A+'], [80, 'A'], [70, 'B'], [50, 'C'], [0, 'F']],
    caps: [
      {
        id: 'model', max: 'C', message: MODEL_GATE_MESSAGE,
        // Unanswered is not passed: a gate nobody looked at has not been cleared.
        applies: (a) => (a.sweep_tier ?? 'none') === 'none' || a.singular_gap !== true,
      },
      {
        id: 'diagonal', max: 'B', message: DIAGONAL_CAP_MESSAGE,
        applies: (a) => a.target_type === 'Trendline/diagonal',
      },
    ],
  },
  4: {
    version: 4,
    since: '2026-10-01',
    trial: true,
    weights: {
      chk_htf_bias: 10, chk_killzone: 10, chk_no_news: 5,
      singular_gap: 10, chk_displacement_fvg: 10, chk_targets_clear: 10, chk_clean_path: 5,
      chk_returned_to_fvg: 5, chk_inversion_close: 15,
    },
    liquidity: { sweep: { major: 20, minor: 12, none: 0 }, delivery: 12, both: 20 },
    required: ['singular_gap', 'chk_returned_to_fvg', 'chk_inversion_close'],
    letters: [[100, 'A+'], [80, 'A'], [70, 'B'], [50, 'C'], [0, 'F']],
    caps: [
      {
        id: 'model', max: 'C', message: LIQUIDITY_GATE_MESSAGE,
        applies: (a) => liquidityEvent(a) === 'none' || a.singular_gap !== true,
      },
      {
        id: 'delivery', max: 'B', message: DELIVERY_CAP_MESSAGE,
        applies: (a) => liquidityEvent(a) === 'delivery',
      },
      {
        id: 'aplus', max: 'A', message: APLUS_CAP_MESSAGE,
        applies: (a) => liquidityEvent(a) !== 'both',
      },
      {
        id: 'diagonal', max: 'B', message: DIAGONAL_CAP_MESSAGE,
        applies: (a) => a.target_type === 'Trendline/diagonal',
      },
    ],
  },
};

/** The rubric every trade is graded and frozen under. Never a trial. */
export const CURRENT_RUBRIC = 3;

/**
 * The rubric on trial, or null when nothing is. A trial rubric is graded
 * beside CURRENT_RUBRIC on every read — on the form, the detail panel and in
 * Stats — but is never written onto a trade, so trying a rule out can never
 * re-grade history or move a live number. Promote it by raising
 * CURRENT_RUBRIC to it (and following db/RUBRIC.md) once the sample says so.
 */
export const TRIAL_RUBRIC: number | null = 4;

/** Trades a trial needs before its verdict means anything. */
export const TRIAL_SAMPLE = 30;

/** The first rubric with the model gates. Trades graded before it were never held to them. */
export const GATES_SINCE = 2;

export interface FrozenGrade {
  score: number;
  letter: GradeLetter;
  trigger: boolean;
  /** Points earned and points that applied, for the form's "72/90". */
  earned: number;
  possible: number;
  /** The caps that held the letter down, strictest first. Empty under rubric 1. */
  caps: GradeCap[];
}

/** The worse of two letters. */
export function worseLetter(a: GradeLetter, b: GradeLetter): GradeLetter {
  return GRADE_LETTERS.indexOf(a) >= GRADE_LETTERS.indexOf(b) ? a : b;
}

/**
 * The grade a set of answers gets under one rubric version. A box answered
 * null did not apply: its weight is neither offered nor missed, exactly as the
 * generated columns do it — unless the rubric says that box is required. An
 * unknown version grades under the oldest one rather than throwing — a trade
 * must always be readable.
 */
export function gradeUnder(version: number, answers: GradeInput): FrozenGrade {
  const rubric = RUBRICS[version] ?? RUBRICS[1];
  let earned = 0;
  let possible = 0;
  for (const [key, w] of Object.entries(rubric.weights) as Array<[BoxKey, number]>) {
    const a = answers[key];
    if (a === null && !rubric.required?.includes(key)) continue;
    possible += w;
    if (a === true) earned += w;
  }
  if (rubric.liquidity) {
    const l = rubric.liquidity;
    possible += Math.max(l.both, l.delivery, ...Object.values(l.sweep));
    const event = liquidityEvent(answers);
    earned += event === 'both' ? l.both
      : event === 'delivery' ? l.delivery
      : event === 'sweep' ? l.sweep[effectiveSweep(answers)] : 0;
  } else if (rubric.sweep) {
    possible += Math.max(...Object.values(rubric.sweep));
    earned += rubric.sweep[answers.sweep_tier ?? 'none'] ?? 0;
  }
  const score = possible === 0 ? 0 : Math.round((earned * 100) / possible);
  const caps = (rubric.caps ?? [])
    .filter((c) => c.applies(answers))
    .sort((x, y) => GRADE_LETTERS.indexOf(y.max) - GRADE_LETTERS.indexOf(x.max));
  const band = rubric.letters.find(([min]) => score >= min)?.[1] ?? 'F';
  const letter = caps.reduce<GradeLetter>((l, c) => worseLetter(l, c.max), band);
  const trigger = TRIGGER_KEYS.every((k) => answers[k] === true);
  return { score, letter, trigger, earned, possible, caps };
}
