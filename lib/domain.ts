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
  // Backtest only (019): offered on that account and nowhere else, so replayed
  // trades gather in their own whiteboard group instead of joining real ones.
  'Backtest replay',
] as const;

export const BACKTEST_REASON = 'Backtest replay' as const;

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
/**
 * What the trade was aimed at, as named, explicit liquidity.
 *
 * "Other" is gone: a target you cannot name is not a target, and it was the
 * option every unplanned trade hid behind. Trendline/diagonal is still here
 * because it is sometimes the honest answer — but it caps the grade at B (see
 * lib/rubric.ts), because a diagonal is drawn, not found, and moves every
 * candle.
 */
export const TARGET_TYPES = [
  'EQH/EQL',
  'PDH/PDL',
  'Session high/low',
  'Data wick (ITH/ITL)',
  'Order block',
  'CISD',
  'Trendline/diagonal',
] as const;
/**
 * Target types no longer offered, still accepted. Trades were filed under
 * them, and a value dropped from validation makes those trades unsaveable on
 * their next edit — the same rule as ACCOUNT_VALUES.
 */
export const RETIRED_TARGET_TYPES = ['Horizontal liquidity pool', 'Opposing FVG', 'Other'] as const;
export const TARGET_TYPE_VALUES = [...TARGET_TYPES, ...RETIRED_TARGET_TYPES] as const;
/** Renamed rather than retired: migration 015 moved every stored row across. */
export const RENAMED_TARGET_TYPES: Record<string, (typeof TARGET_TYPES)[number]> = {
  'Data wick': 'Data wick (ITH/ITL)',
  'Diagonal trendline': 'Trendline/diagonal',
};
/** The weakest target class. Caps the grade at B under rubric 2. */
export const WEAK_TARGET = 'Trendline/diagonal';
export const WEAK_TARGET_WARNING = 'Diagonals are subjective and move every candle. Weakest target class.';

/** The picker's options: the offered list, plus a retired value an old trade still holds. */
export function targetTypeOptions(current: TargetType | null): readonly TargetType[] {
  return current && !(TARGET_TYPES as readonly string[]).includes(current)
    ? [current, ...TARGET_TYPES] : TARGET_TYPES;
}

export const OUTCOMES = ['Win', 'Loss', 'Breakeven', 'Scratched', 'Not taken'] as const;

export type Instrument = (typeof INSTRUMENTS)[number];
export type Direction = (typeof DIRECTIONS)[number];
export type Session = (typeof SESSIONS)[number];
export type Reason = (typeof REASONS)[number];
export type SetupType = (typeof SETUP_TYPES)[number];
export type HtfBias = (typeof HTF_BIASES)[number];
export type PremiumDiscount = (typeof PREMIUM_DISCOUNTS)[number];
export type TargetType = (typeof TARGET_TYPE_VALUES)[number];
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
/**
 * Context no longer asked on the form.
 *
 * "The setup" group asked six yes/no questions that nobody used and nothing
 * read, and it sat where "What worked" now does. The columns stay: every
 * trade that answered them keeps its answers, an edit passes them through
 * untouched, and the detail panel still shows the ones that were set.
 *
 * "Singular gap" left this list for the checklist, where it is a gate: see
 * CHECKLIST_PHASES and migration 015.
 */
export const RETIRED_CONTEXT = {
  label: 'The setup',
  flags: [
    { key: 'sweep_before_entry', label: 'Sweep before entry', hint: 'Was liquidity swept near the gap?' },
    { key: 'displacement', label: 'Displacement', hint: 'Did price actually displace through the gap, or drift?' },
    { key: 'mss_confirmed', label: 'MSS confirmed', hint: 'Had market structure shifted before you entered?' },
    { key: 'volume_imbalance', label: 'Volume imbalance', hint: 'A gap in delivery between the candle bodies.' },
    { key: 'consequent_encroachment', label: 'Consequent encroachment', hint: 'Did the entry respect the 50% of the gap?' },
  ],
} as const;

/**
 * Context the form no longer asks for either.
 *
 * "Target, timing & confluence" duplicated what the checklist and the target
 * type dropdown now ask properly, and sat folded away at the bottom of the
 * form. Retired the same way as "The setup": the columns stay, every trade
 * that answered keeps its answers, edits pass them through, and the detail
 * panel still shows the ones that were set.
 */
export const CONTEXT_GROUPS = [
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

export type ContextFlag =
  | (typeof CONTEXT_GROUPS)[number]['flags'][number]['key']
  | (typeof RETIRED_CONTEXT)['flags'][number]['key'];

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
export const CONTEXT_FLAG_LIST: ContextFlagSpec[] = [
  ...RETIRED_CONTEXT.flags.map((flag) => ({ ...flag })),
  ...CONTEXT_GROUPS.flatMap((group) => group.flags.map((flag) => ({ ...flag }))),
];

export const CONTEXT_FLAGS: ContextFlag[] = CONTEXT_FLAG_LIST.map((f) => f.key);

/**
 * How clean the sweep was. A radio rather than a box, because "was there a
 * sweep" was the wrong question: a minor but nameable pool is a real sweep and
 * worth something, a random wiggle is not, and one checkbox could not say so.
 */
export const SWEEP_TIERS = ['major', 'minor', 'none'] as const;
export type SweepTier = (typeof SWEEP_TIERS)[number];
export const SWEEP_TIER_SPEC: Record<SweepTier, { label: string; points: number; hint: string }> = {
  major: { label: 'MAJOR', points: 20, hint: 'Session high/low, PDH/PDL, weekly or daily EQH/EQL.' },
  minor: {
    label: 'MINOR but nameable', points: 12,
    hint: 'Intraday short-term high/low, equal highs/lows, a prior session pool — you can point at it and say what it is.',
  },
  none: { label: 'NONE', points: 0, hint: 'A random wiggle, or no sweep at all.' },
};

/**
 * The checklist, exactly as the plan states it — rubric 2.
 *
 * Three phases, weighted to 100: Prep 25, Setup 55, Trigger 20. Phase 3 must
 * fire for an entry to exist — a high score with no inversion close is a
 * setup still forming, not a trade — and once it does fire at 70% or more,
 * taking it is the rule rather than a decision.
 *
 * Two items are GATES rather than points: a sweep of nothing nameable, or more
 * than one gap, is not this model at all, and caps the grade at C whatever the
 * total. They cannot be marked N/A — a gate the market "did not offer" is a
 * gate that failed.
 *
 * The 100 is what the plan can award, not what every trade is marked out of.
 * Other Phase 1 and Phase 2 boxes can be answered "did not apply", and their
 * weight then leaves the denominator rather than counting against me.
 *
 * The weights here must match RUBRICS[CURRENT_RUBRIC] in lib/rubric.ts and the
 * generated columns in the schema; `npm test` fails if they drift.
 */
export const CHECKLIST_PHASES = [
  {
    phase: 'Phase 1 — Prep',
    note: 'Before anything else is worth looking at.',
    items: [
      { kind: 'box', key: 'chk_htf_bias', points: 10, label: 'Higher timeframe bias is clear', hint: '1H and 4H agree on direction.' },
      { kind: 'box', key: 'chk_killzone', points: 10, label: 'Inside a killzone', hint: 'London 00:00–03:00 or NY AM 07:30–10:00 (CR).' },
      { kind: 'box', key: 'chk_no_news', points: 5, label: 'No NFP / FOMC / CPI conflict', hint: 'Nothing high-impact due while this trade is live.' },
    ],
  },
  {
    phase: 'Phase 2 — Setup',
    note: 'What the chart actually did. The sweep and the single gap are gates: fail either and it is not the model.',
    items: [
      { kind: 'tier', key: 'sweep_tier', points: 20, label: 'Clear sweep of a nameable level', hint: 'Pick the one that is true. Not the one you wish was.' },
      { kind: 'box', key: 'singular_gap', points: 10, label: 'Singular gap — ONE clean, unmistakable FVG', hint: 'If you drew two overlapping boxes, this is unchecked. Stacked gaps = messy signature.' },
      { kind: 'box', key: 'chk_displacement_fvg', points: 10, label: 'Strong FVG after the sweep', hint: 'Displacement, not drift.' },
      { kind: 'box', key: 'chk_targets_clear', points: 10, label: 'Targets are clear', hint: 'EQH/EQL, PDH/PDL, ITH/ITL, OB or CISD — nameable, not hopeful.' },
      { kind: 'box', key: 'chk_clean_path', points: 5, label: 'Clean path to target', hint: 'No opposing EQH/EQL sitting in the way.' },
    ],
  },
  {
    phase: 'Phase 3 — Trigger',
    note: 'Both of these, or there is no entry. A high score without them is a setup still forming.',
    items: [
      { kind: 'box', key: 'chk_returned_to_fvg', points: 5, label: 'Price returned to the FVG', hint: '' },
      { kind: 'box', key: 'chk_inversion_close', points: 15, label: 'Inversion candle CLOSED through the FVG', hint: 'With momentum. A wick through is not a close through.' },
    ],
  },
] as const;

type PhaseItem = (typeof CHECKLIST_PHASES)[number]['items'][number];

/** A yes/no box on the current checklist. */
export type ChecklistKey = Extract<PhaseItem, { kind: 'box' }>['key'];

/**
 * A box that only rubric 1 asked. "Clear sweep of a MAJOR level" became the
 * sweep tier; its column stays so every trade graded under rubric 1 can still
 * be graded under it (a planned rubric-1 trade re-scores on edit).
 */
export type LegacyChecklistKey = 'chk_sweep';

export interface ChecklistItem {
  key: ChecklistKey;
  points: number;
  label: string;
  hint: string;
  phase: string;
  /** Whether this box can be marked "did not apply" on a given trade. */
  canBeNA: boolean;
  /** A gate: failing it caps the grade, whatever the total. */
  gate: boolean;
}

/**
 * A checklist answer.
 *
 * true  — the condition was met
 * false — it was not
 * null  — it did not apply, so its points were never on the table
 *
 * The third state exists because not every session offers every condition.
 * Scoring an absent condition as a miss capped a flawless setup and then
 * reported a rule break. Gates are the exception: see CHECKLIST_PHASES.
 */
export type ChecklistAnswer = boolean | null;

/** The two Phase 3 answers. Without both, there is no trade. */
export const TRIGGER_KEYS: ChecklistKey[] = ['chk_returned_to_fvg', 'chk_inversion_close'];
/** Boxes that are gates. With the sweep tier, these decide whether it is the model at all. */
export const GATE_KEYS: ChecklistKey[] = ['singular_gap'];

export const CHECKLIST_ITEMS: ChecklistItem[] = CHECKLIST_PHASES.flatMap((p) =>
  p.items.flatMap((item) => (item.kind === 'box' ? [{
    key: item.key,
    points: item.points,
    label: item.label,
    hint: item.hint,
    phase: p.phase,
    // Phase 3 is the trigger — without it there is no entry at all — and a
    // gate the market "did not offer" is a gate that failed. Neither can be N/A.
    canBeNA: !TRIGGER_KEYS.includes(item.key) && !GATE_KEYS.includes(item.key),
    gate: GATE_KEYS.includes(item.key),
  }] : [])),
);

export const CHECKLIST_KEYS: ChecklistKey[] = CHECKLIST_ITEMS.map((i) => i.key);

/** The sweep tier's row on the checklist. */
export const SWEEP_ITEM = CHECKLIST_PHASES[1].items[0];

/** 10+10+5 + 20+10+10+10+5 + 5+15 */
export const GRADE_MAX = CHECKLIST_ITEMS.reduce((sum, i) => sum + i.points, 0) + SWEEP_ITEM.points;

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
 * What worked — the other half of the post-mortem.
 *
 * A journal that only records mistakes teaches you what not to do and nothing
 * about what to repeat. These mirror the mistakes, so a winner that was traded
 * well and a loser that was traded well can be told apart from luck.
 */
export const WORKED_TAGS = [
  'Waited for the close', 'Entered on the retest', 'Took only the A+', 'With HTF bias',
  'Inside the killzone', 'Clear target named', 'Stop where the idea fails', 'Sized correctly',
  'Let the winner run', 'Managed to plan', 'Respected the news', 'Stopped at the limit',
  'Stayed patient', 'Followed the plan exactly',
] as const;
export type WorkedTag = (typeof WORKED_TAGS)[number];

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
 * What a new trade can be filed under.
 *
 * Backtesting moved out of this journal once and is back: replayed trades are
 * worth journaling with the same checklist — as long as they stay in their own
 * account. The stored value keeps its old name so the trades filed under it
 * before are the same account; it reads as "Backtest" everywhere (accountLabel).
 */
export const BACKTEST: Account = 'Backtest (FX Replay)';
export const ACCOUNTS: readonly Account[] = ['Demo', 'Live', 'Funded', BACKTEST, 'Missed'];

/** How an account reads on screen. */
export const accountLabel = (account: string): string => (account === BACKTEST ? 'Backtest' : account);
export const isBacktest = (account: string | null | undefined): boolean => account === BACKTEST;

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

/**
 * Accounts kept apart from everything else: never in "All accounts", never in
 * a real total, a risk limit, a streak, a calendar day or a balance — each is
 * only ever seen on its own.
 *
 * Missed, because those trades did not happen. Backtest, because replay fills
 * are not real fills and a replayed trade carries no fear: backtest R and live
 * R must never sum into the same number. They differ in what else they mean —
 * Missed is hypothetical (would-have R, why I hesitated), Backtest is not — so
 * code that is about separation asks isSeparate, and code about hesitation
 * asks isHypothetical.
 */
export const SEPARATE_ACCOUNTS: readonly Account[] = [BACKTEST, 'Missed'];
export const isSeparate = (account: string | null | undefined): boolean =>
  (SEPARATE_ACCOUNTS as readonly string[]).includes(account ?? '');
/** In "All accounts" and every real total. */
export const isReal = (account: string | null | undefined): boolean => !isSeparate(account);

/** Whether `date` is the day the trade happened (it is not on an undated backtest). */
export const isDated = (t: { undated?: boolean | null }): boolean => !t.undated;

/** Where money can go in and out: real accounts only. */
export const MONEY_ACCOUNTS: readonly Account[] = ACCOUNTS.filter((a) => isReal(a));

/**
 * The options a picker should show, given what is already selected: the
 * current value is always included, even if it is ever no longer on offer.
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
  'Backtest replay': 100, // chartreuse — its own corner, near no real reason
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
export function isScored(
  t: Partial<Record<ChecklistKey | LegacyChecklistKey, ChecklistAnswer>> & { sweep_tier?: SweepTier | null },
): boolean {
  return CHECKLIST_KEYS.some((k) => t[k] === true)
    || t.chk_sweep === true
    || t.sweep_tier === 'major' || t.sweep_tier === 'minor';
}
