// Every enum in the app. These lists mirror the CHECK constraints in
// db/migrations/001_init.sql — if you add a value here, add it there too.

export const INSTRUMENTS = ['NQ', 'MNQ', 'NAS100', 'Other'] as const;
export const DIRECTIONS = ['Long', 'Short'] as const;
export const SESSIONS = ['Asia', 'London', 'NY AM', 'NY Lunch', 'NY PM'] as const;

/** The spine of the whole app: why you took it, named before you rationalize. */
export const REASONS = [
  'Rules-based (A+ setup)',
  'Rules-based (B setup)',
  'FOMO',
  'Revenge',
  'Boredom',
  'Idea / hypothesis',
  'Following the market',
  'Following someone else',
  'Impatience (early entry)',
  'Hesitation (late entry)',
  'Overleveraged',
  'News reaction',
] as const;

/**
 * Setup vocabulary, iFVG-first.
 *
 * These are the standard names in the iFVG / ICT family rather than any one
 * trader's private taxonomy — tell me the exact list you work from and I will
 * match it. Adding a value means a migration, because SQLite cannot alter a
 * CHECK constraint in place: see 003_setup_types.sql for the pattern.
 */
export const SETUP_TYPES = [
  'iFVG',
  'Double iFVG',
  'iFVG + SMT',
  'MSS + FVG',
  'CISD',
  'Order Block',
  'Breaker',
  'Unicorn (Breaker + FVG)',
  'Propulsion Block',
  'Mitigation Block',
  'Rejection Block',
  'Liquidity Void',
  'Balanced Price Range',
  'Turtle Soup',
  'Silver Bullet',
  'Other',
] as const;
export const HTF_BIASES = ['With bias', 'Against bias', 'No bias defined'] as const;
export const PREMIUM_DISCOUNTS = ['Discount', 'Equilibrium', 'Premium'] as const;
export const TARGET_TYPES = [
  'Horizontal liquidity pool',
  'Opposing FVG',
  'Data wick',
  'Session high/low',
  'Diagonal trendline',
  'Other',
] as const;
export const OUTCOMES = ['Win', 'Loss', 'Breakeven', 'Scratched', 'Not taken'] as const;

export type Instrument = (typeof INSTRUMENTS)[number];
export type Direction = (typeof DIRECTIONS)[number];
export type Session = (typeof SESSIONS)[number];
export type Reason = (typeof REASONS)[number];
export type SetupType = (typeof SETUP_TYPES)[number];
export type HtfBias = (typeof HTF_BIASES)[number];
export type PremiumDiscount = (typeof PREMIUM_DISCOUNTS)[number];
export type TargetType = (typeof TARGET_TYPES)[number];
export type Outcome = (typeof OUTCOMES)[number];

/** 'Not taken' rows are journalled but never priced — see lib/stats.ts. */
export const SETTLED_OUTCOMES = OUTCOMES.filter((o) => o !== 'Not taken');
export function isTaken(outcome: Outcome): boolean {
  return outcome !== 'Not taken';
}

/**
 * The context checklist, in the order it appears during capture.
 *
 * Split into two groups because eleven pills in one undifferentiated block is a
 * wall: the first group is what the setup looked like, the second is what was
 * confirming it and what was in the way.
 */
export const CONTEXT_GROUPS = [
  {
    label: 'The setup',
    flags: [
      { key: 'sweep_before_entry', label: 'Sweep before entry', hint: 'Was liquidity swept near the gap?' },
      { key: 'singular_gap', label: 'Singular gap', hint: 'Rule 1 — one clean obvious gap, not stacked.' },
      { key: 'displacement', label: 'Displacement', hint: 'Did price actually displace through the gap, or drift?' },
      { key: 'mss_confirmed', label: 'MSS confirmed', hint: 'Had market structure shifted before you entered?' },
      { key: 'volume_imbalance', label: 'Volume imbalance', hint: 'A gap in delivery between the candle bodies.' },
      { key: 'consequent_encroachment', label: 'Consequent encroachment', hint: 'Did the entry respect the 50% of the gap?' },
    ],
  },
  {
    label: 'Target, timing & confluence',
    flags: [
      { key: 'target_unswept', label: 'Target unswept', hint: 'Rule 4 — the next high/low was still unswept.' },
      { key: 'equal_highs_lows', label: 'Equal highs / lows', hint: 'Were you targeting a pair of equal highs or lows?' },
      { key: 'smt', label: 'SMT divergence', hint: 'Divergence against the correlated instrument.' },
      { key: 'retest_entry', label: 'Retest entry', hint: 'Entered on the retest rather than grabbing it immediately.' },
      { key: 'news_window', label: 'News window', hint: 'Entry landed inside a high-impact news window.' },
    ],
  },
] as const;

export type ContextFlag = (typeof CONTEXT_GROUPS)[number]['flags'][number]['key'];

export interface ContextFlagSpec {
  key: ContextFlag;
  label: string;
  hint: string;
}

/**
 * Every context flag in one flat, plainly-typed list.
 *
 * Flattening CONTEXT_GROUPS at each call site infers the `as const` tuples too
 * narrowly to be useful, so widen it once here.
 */
export const CONTEXT_FLAG_LIST: ContextFlagSpec[] =
  CONTEXT_GROUPS.flatMap((group) => group.flags.map((flag) => ({ ...flag })));

export const CONTEXT_FLAGS: ContextFlag[] = CONTEXT_FLAG_LIST.map((f) => f.key);

/**
 * The checklist, exactly as the plan states it.
 *
 * Three phases, weighted to 100. Phase 3 must fire for an entry to exist — a
 * high score with no inversion close is a setup still forming, not a trade —
 * and once it does fire at 70% or more, taking it is the rule rather than a
 * decision. The weights live here and in the schema's generated columns; the
 * score is computed by SQLite so it can never disagree with the answers.
 *
 * The 100 is what the plan can award, not what every trade is marked out of.
 * A Phase 1 or Phase 2 box can be answered "did not apply" — no major level
 * anywhere near price is not a sweep I missed — and its weight then leaves the
 * denominator rather than counting against me. Phase 3 cannot: without the
 * trigger there is no entry to grade at all.
 */
export const CHECKLIST_PHASES = [
  {
    phase: 'Phase 1 — Prep',
    note: 'Before anything else is worth looking at.',
    items: [
      { key: 'chk_htf_bias', points: 10, label: 'Higher timeframe bias is clear', hint: '1H and 4H agree on direction.' },
      { key: 'chk_killzone', points: 10, label: 'Inside a killzone', hint: 'London 00:00–03:00 or NY AM 07:30–10:00 (CR).' },
      { key: 'chk_no_news', points: 5, label: 'No NFP / FOMC / CPI conflict', hint: 'Nothing high-impact due while this trade is live.' },
    ],
  },
  {
    phase: 'Phase 2 — Setup',
    note: 'What the chart actually did.',
    items: [
      { key: 'chk_sweep', points: 20, label: 'Clear sweep of a MAJOR level', hint: 'Session high/low, PDH/PDL, EQH/EQL — not a random wiggle.' },
      { key: 'chk_displacement_fvg', points: 15, label: 'Strong FVG after the sweep', hint: 'Displacement, not drift.' },
      { key: 'chk_targets_clear', points: 15, label: 'Targets are clear', hint: 'EQH/EQL, ITH/ITL, OB or CISD — nameable, not hopeful.' },
      { key: 'chk_clean_path', points: 5, label: 'Clean path to target', hint: 'No opposing EQH/EQL sitting in the way.' },
    ],
  },
  {
    phase: 'Phase 3 — Trigger',
    note: 'Both of these, or there is no entry. A high score without them is a setup still forming.',
    items: [
      { key: 'chk_returned_to_fvg', points: 5, label: 'Price returned to the FVG', hint: '' },
      { key: 'chk_inversion_close', points: 15, label: 'Inversion candle CLOSED through the FVG', hint: 'With momentum. A wick through is not a close through.' },
    ],
  },
] as const;

export type ChecklistKey = (typeof CHECKLIST_PHASES)[number]['items'][number]['key'];

export interface ChecklistItem {
  key: ChecklistKey;
  points: number;
  label: string;
  hint: string;
  phase: string;
  /** Whether this box can be marked "did not apply" on a given trade. */
  canBeNA: boolean;
}

/**
 * A checklist answer.
 *
 * true  — the condition was met
 * false — it was not
 * null  — it did not apply, so its points were never on the table
 *
 * The third state exists because not every session offers every condition. If
 * price is nowhere near a major level, "Clear sweep of a MAJOR level" is not a
 * rule that was broken; it is a question the market did not ask. Scoring it as
 * a miss capped a flawless setup at 80 and then reported a rule break.
 */
export type ChecklistAnswer = boolean | null;

/** The two Phase 3 answers. Without both, there is no trade. */
export const TRIGGER_KEYS: ChecklistKey[] = ['chk_returned_to_fvg', 'chk_inversion_close'];

export const CHECKLIST_ITEMS: ChecklistItem[] = CHECKLIST_PHASES.flatMap((p) =>
  p.items.map((item) => ({
    ...item,
    phase: p.phase,
    // Phase 3 is the trigger. Without the return to the FVG and the inversion
    // close there is no entry at all, so "it did not apply" cannot be true of
    // a trade that exists — those two are always on the table.
    canBeNA: !TRIGGER_KEYS.includes(item.key),
  })),
);

export const CHECKLIST_KEYS: ChecklistKey[] = CHECKLIST_ITEMS.map((i) => i.key);

/** 10+10+5 + 20+15+15+5 + 5+15 */
export const GRADE_MAX = CHECKLIST_ITEMS.reduce((sum, i) => sum + i.points, 0);

/** "If trigger fires and score >= 70, I ENTER. No exceptions." */
export const TAKE_IT_THRESHOLD = 70;

/**
 * What went wrong, after the fact. Multi-select, because a bad trade usually
 * has three — "entered late" and "chased" and "oversized" are one story, and
 * forcing a single choice throws two thirds of it away.
 */
export const MISTAKE_TAGS = [
  'Entered late', 'Entered early', 'No trigger', 'Chased', 'Moved stop',
  'Cut winner early', 'Oversized', 'Undersized', 'Outside killzone',
  'Against HTF bias', 'No defined target', 'Revenge', 'Overtraded',
  'Ignored news', 'Widened stop',
] as const;
export type MistakeTag = (typeof MISTAKE_TAGS)[number];

/**
 * Backtest R and live R must never sum into the same number. Replay fills are
 * not real fills, and a demo account has no fear in it.
 */
/**
 * Every account label the schema will accept, including retired ones.
 *
 * Validation and display read this. 'Backtest (FX Replay)' is still here
 * because trades were filed under it: dropping a value from the type because
 * the form stopped offering it would make those rows fail validation on their
 * next edit, which is the app refusing to save its own history.
 */
export const ACCOUNT_VALUES = ['Backtest (FX Replay)', 'Demo', 'Live', 'Funded', 'Missed'] as const;
export type Account = (typeof ACCOUNT_VALUES)[number];

/**
 * What a new trade or deposit can be filed under.
 *
 * Backtesting moved out of this journal, so it is no longer offered — but see
 * ACCOUNT_VALUES: not offered is not the same as not allowed.
 */
export const ACCOUNTS: readonly Account[] = ['Demo', 'Live', 'Funded', 'Missed'];

/**
 * Accounts whose trades did not happen.
 *
 * 'Missed' holds the setups I saw and hesitated on or missed, logged with the
 * outcome and R they would have had. That makes it the one place that can say
 * what hesitation costs — and the one account whose numbers must never join a
 * real total, a risk limit, a streak or a balance. A hypothetical +2R summed
 * into a live month is a month that did not happen.
 */
export const HYPOTHETICAL_ACCOUNTS: readonly Account[] = ['Missed'];
export const isHypothetical = (account: string | null | undefined): boolean =>
  (HYPOTHETICAL_ACCOUNTS as readonly string[]).includes(account ?? '');

/** Where money can go in and out: real accounts only. */
export const MONEY_ACCOUNTS: readonly Account[] = ACCOUNTS.filter((a) => !isHypothetical(a));

/**
 * The options a picker should show, given what is already selected.
 *
 * An edit of an old backtest trade has to be able to keep saying backtest, so
 * the current value is always included even when it is no longer on offer.
 */
export function accountOptions(current: Account | null): readonly Account[] {
  return current && !ACCOUNTS.includes(current) ? [current, ...ACCOUNTS] : ACCOUNTS;
}

/**
 * Two-stage logging, available but never required. 'Settled' is the default
 * because logging a finished trade in one shot has to stay the fast path — a
 * trade written in ten seconds after a bad session beats a perfect record that
 * never gets written.
 */
export const TRADE_STATUSES = ['Planned', 'Live', 'Settled'] as const;
export type TradeStatus = (typeof TRADE_STATUSES)[number];

/**
 * Tri-state, for questions where "I didn't answer" is a real and different
 * answer from "no".
 *
 * followed_rules used to be a plain boolean defaulting to true, which meant
 * every trade ever saved claimed full rule adherence whether or not the
 * question had been looked at. Unanswered is now representable, and is the
 * default.
 */
export type Tri = boolean | null;
export const TRI_LABELS = { unset: 'Unset', yes: 'Yes', no: 'No' } as const;

export function triToLabel(v: Tri): 'Unset' | 'Yes' | 'No' {
  return v === null ? 'Unset' : v ? 'Yes' : 'No';
}
export function labelToTri(v: 'Unset' | 'Yes' | 'No'): Tri {
  return v === 'Unset' ? null : v === 'Yes';
}

/** The honest re-grade after the close, which is allowed to be harsher. */
export const REGRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C', 'F'] as const;
export type Regrade = (typeof REGRADES)[number];

/** Why a valid setup was skipped. The plan calls this the most important sheet. */
/** The morning check-in. See 013_morning_checkin.sql. */
export const BIAS_DIRECTIONS = ['Bullish', 'Bearish', 'Neutral'] as const;
export type BiasDirection = (typeof BIAS_DIRECTIONS)[number];
export const NEWS_LEVELS = ['None', 'Medium', 'High'] as const;
export type NewsLevel = (typeof NEWS_LEVELS)[number];

export const SKIP_REASONS = ['Fear', 'Rule', 'Distracted', 'Missed it'] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

/** Per-reason cluster identity. Hue drives the halo, the edges and the header. */
export const REASON_HUE: Record<Reason, number> = {
  'Rules-based (A+ setup)': 152, // mint-green — the standard
  'Rules-based (B setup)': 168,
  FOMO: 4, // red — the leak
  Revenge: 348,
  Boredom: 28, // amber
  'Idea / hypothesis': 268, // violet
  'Following the market': 210, // blue
  'Following someone else': 194,
  'Impatience (early entry)': 44,
  'Hesitation (late entry)': 62,
  Overleveraged: 320,
  'News reaction': 240,
};


/**
 * Screenshot slots, in the order a trade is actually read.
 *
 * One image is not a trade: the HTF frame is why you were looking, the entry
 * is what you acted on, and the result is what the market did with it. Only
 * the first is required, so logging stays a ten-second job.
 */
export const SHOT_SLOTS = ['HTF context', 'Entry', 'Result', 'Other'] as const;
export type ShotSlot = (typeof SHOT_SLOTS)[number];

/** Score bands for the question "is my grading predictive?". */
export const GRADE_BANDS = [
  { label: '0–49', min: 0, max: 49 },
  { label: '50–69', min: 50, max: 69 },
  { label: '70–84', min: 70, max: 84 },
  { label: '85–100', min: 85, max: 100 },
] as const;

/** Below this, a bucket is noise and the app says so rather than drawing a conclusion. */
export const MIN_SAMPLE = 20;

/** Recorded before the outcome is known, or it measures nothing. */
export const CONFIDENCE_LEVELS = [1, 2, 3, 4, 5] as const;


/**
 * Was this trade's checklist actually answered?
 *
 * Every box starting false is deliberate — nothing on the form asserts
 * anything I did not say — but it means "not filled in" and "failed every
 * item" look identical in the data. This is the one place that distinction is
 * recoverable: if no box is ticked at all, the checklist was skipped.
 */
export function isScored(t: Partial<Record<ChecklistKey, ChecklistAnswer>>): boolean {
  return CHECKLIST_KEYS.some((k) => t[k] === true);
}
