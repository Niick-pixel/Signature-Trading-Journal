/**
 * The chart prep: the deeper morning routine, done on the chart before the
 * New York session.
 *
 * The check-in asks four questions in thirty seconds. This walks the chart
 * top-down in eleven steps — higher timeframe, prior levels, the overnight
 * sessions, equal highs and lows, gaps, zones, the order-book heatmap, the
 * draw on liquidity, the if–then plans, the timing, and the commitment — each
 * one a short list of things to mark on the chart, ticked as they are drawn.
 * The prices typed in along the way become the day's map: every level in one
 * ladder, the target and the invalidation on it.
 *
 * Like the check-in it is a prompt, never a gate. Any step can be skipped,
 * nothing in the app waits on it, and every field is optional. Times are New
 * York time, because that is the clock the sessions are defined on.
 */

export type PrepInput = 'bias' | 'fixed' | 'list' | 'draw' | 'plans' | 'timing' | 'commit';

export interface PrepStep {
  id: string;
  title: string;
  /** The timeframes to look at for this step. */
  frames?: string;
  /** What to draw, one line per mark — each is ticked as it goes on the chart. */
  marks: string[];
  /** Why it matters, in a line. */
  why: string;
  input: PrepInput;
  /** Fixed levels to fill in, for 'fixed'. */
  fixed?: string[];
  /** The kinds a row can be, for 'list'. */
  kinds?: string[];
  /** Whether a list row is a zone (two prices) rather than a line. */
  range?: boolean;
  /** Offers the order-book heatmap link. */
  heatmap?: boolean;
}

export const PREP_STEPS: PrepStep[] = [
  {
    id: 'htf', title: 'Higher timeframe picture', frames: 'Daily · 4H', input: 'bias',
    marks: [
      'Mark the daily and 4H swing high and low that price is trading inside.',
      'Draw the 50% of that range — above it is premium, below it discount.',
      'Box the nearest unfilled daily or 4H FVG above and below price.',
    ],
    why: 'Everything after this is read against it. A long in premium against a bearish daily is a different trade.',
  },
  {
    id: 'prior', title: 'Previous day and week', frames: 'Daily · Weekly', input: 'fixed',
    fixed: ['PDH', 'PDL', 'PWH', 'PWL'],
    marks: [
      'Line at the previous day high (PDH) and low (PDL).',
      'Line at the previous week high (PWH) and low (PWL).',
      'Note which of them price has already taken.',
    ],
    why: 'The most obvious stops on the chart. Obvious to you is obvious to everyone — that is why they get run.',
  },
  {
    id: 'sessions', title: 'Overnight sessions', frames: '15m · 5m', input: 'fixed',
    fixed: ['Asia high', 'Asia low', 'London high', 'London low', 'Midnight open'],
    marks: [
      'Box the Asia range (20:00–00:00 New York) — its high and low.',
      'Box London (02:00–05:00 New York) — its high and low.',
      'Line at the New York midnight open.',
      'Note which Asia high or low London already swept.',
    ],
    why: 'New York usually runs one side of the overnight range first. Knowing which side is left is half the plan.',
  },
  {
    id: 'eqhl', title: 'Equal highs and lows', frames: '1H · 15m', input: 'list', kinds: ['EQH', 'EQL'],
    marks: [
      'Find the relative equal highs and lows — clean double tops and bottoms.',
      'Draw a line through each; those are resting stops.',
      'Circle the ones closest to price — the likeliest first draw.',
    ],
    why: 'Equal highs and lows are the cleanest liquidity there is: two failures at the same price, every stop behind them.',
  },
  {
    id: 'gaps', title: 'Important gaps', frames: '4H · 1H · 15m', input: 'list', range: true,
    kinds: ['FVG', 'NWOG', 'NDOG', 'Volume imbalance'],
    marks: [
      'Box every unfilled 1H and 4H fair value gap near price.',
      "Mark this week's opening gap (NWOG) and today's (NDOG), if there is one.",
      'Note the volume imbalances the last displacement left behind.',
    ],
    why: 'Price returns to rebalance gaps. The iFVG model needs to know which ones matter before one is in play.',
  },
  {
    id: 'zones', title: 'High resistance and support zones', frames: '4H · 1H', input: 'list', range: true,
    kinds: ['Resistance', 'Support', 'Order block', 'Breaker'],
    marks: [
      'Box the order blocks and breakers price has reacted to before.',
      'Mark the zones that have rejected price more than once.',
      'Label each one resistance or support.',
    ],
    why: 'Where price is likely to stall — which is where targets belong and entries do not.',
  },
  {
    id: 'heatmap', title: 'Liquidity from the heatmap', frames: 'Order book', input: 'list', heatmap: true,
    kinds: ['Bid wall', 'Ask wall', 'Liquidity pool'],
    marks: [
      'Open the order-book heatmap.',
      'Find the thick bands that have held for hours — resting size, not noise.',
      'Move each one to your chart as a level: bids below price, asks above.',
      'Leave out bands that flicker in and out — that is spoofing, not liquidity.',
    ],
    why: 'The chart shows where stops probably are; the book shows where size actually sits. Delayed data still shows the walls.',
  },
  {
    id: 'draw', title: 'Draw on liquidity', input: 'draw',
    marks: [
      'Look at everything marked: which pool is price most likely to run first?',
      "Mark that level as today's target.",
      'Mark the price that would prove the read wrong.',
    ],
    why: 'One target and one invalidation, decided before the open, is the difference between a plan and a hope.',
  },
  {
    id: 'plans', title: 'If–then plans', input: 'plans',
    marks: [
      'Write the long: which sweep, which gap inverts, which target.',
      'Write the short, the same way.',
      'Anything that fits neither plan is not a trade today.',
    ],
    why: 'Decided calmly now, executed without deciding at 9:45. That is the whole point of doing this first.',
  },
  {
    id: 'timing', title: 'News and timing', input: 'timing',
    marks: [
      'Put a vertical line at every red-folder release today.',
      'Shade the New York AM killzone: 09:30–12:00 New York.',
      'No entries in the minutes either side of high-impact news.',
    ],
    why: 'The best setup at the wrong minute is a coin flip with a spread.',
  },
  {
    id: 'commit', title: 'Commit', input: 'commit',
    marks: [
      'Set alerts on the levels that matter, then stop watching every tick.',
      'Decide the most trades and the loss that ends the day.',
      'Only the model: a nameable sweep, one clean gap, an inversion close.',
    ],
    why: 'The last thing decided before the open is when to stop. It is the one decision that cannot be made well later.',
  },
];

export const PREP_STEP_IDS = PREP_STEPS.map((s) => s.id);

export type StepState = 'done' | 'skipped';
export type DrawDirection = 'Up' | 'Down' | 'Unclear';
export const DRAW_DIRECTIONS: DrawDirection[] = ['Up', 'Down', 'Unclear'];
export type PremiumDiscount = 'Premium' | 'Equilibrium' | 'Discount';
export const PD_ZONES: PremiumDiscount[] = ['Premium', 'Equilibrium', 'Discount'];

/** One mark on the chart that was given a price. */
export interface PrepLevel {
  id: string;
  /** Which step it was marked in. */
  step: string;
  /** PDH, EQH, FVG, Bid wall… */
  kind: string;
  price: number | null;
  /** The far edge of a zone or gap; null for a line. */
  price2: number | null;
  note: string;
  /** Already run before the prep — still worth seeing, not a target. */
  taken: boolean;
}

export interface PrepData {
  steps: Record<string, StepState>;
  /** Which marks of each step are on the chart. */
  ticks: Record<string, number[]>;
  levels: PrepLevel[];
  htf: { bias: 'Bullish' | 'Bearish' | 'Neutral' | null; zone: PremiumDiscount | null; priceNow: number | null; note: string };
  draw: { direction: DrawDirection | null; target: number | null; invalidation: number | null; note: string };
  plans: { long: string; short: string };
  timing: { note: string };
  commit: { maxTrades: number | null; maxLoss: number | null };
}

export interface SessionPrep {
  day: string;
  data: PrepData;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export const EMPTY_PREP: PrepData = {
  steps: {}, ticks: {}, levels: [],
  htf: { bias: null, zone: null, priceNow: null, note: '' },
  draw: { direction: null, target: null, invalidation: null, note: '' },
  plans: { long: '', short: '' },
  timing: { note: '' },
  commit: { maxTrades: null, maxLoss: null },
};

const MAX_LEVELS = 80;
const text = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '');
const price = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | null =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : null;
const obj = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : {});

/**
 * Anything in, a valid prep out. Unknown keys are dropped, bad values become
 * empty, and nothing is ever refused — a half-typed price must not lose the
 * rest of a morning's work.
 */
export function parsePrepData(raw: unknown): PrepData {
  const r = obj(raw);
  const steps: Record<string, StepState> = {};
  for (const [id, v] of Object.entries(obj(r.steps))) {
    if (PREP_STEP_IDS.includes(id) && (v === 'done' || v === 'skipped')) steps[id] = v;
  }
  const ticks: Record<string, number[]> = {};
  for (const [id, v] of Object.entries(obj(r.ticks))) {
    const step = PREP_STEPS.find((s) => s.id === id);
    if (!step || !Array.isArray(v)) continue;
    ticks[id] = [...new Set(v.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < step.marks.length))].sort();
  }
  const levels: PrepLevel[] = (Array.isArray(r.levels) ? r.levels : []).slice(0, MAX_LEVELS).flatMap((raw2) => {
    const l = obj(raw2);
    const step = PREP_STEPS.find((s) => s.id === l.step);
    if (!step) return [];
    const kind = text(l.kind, 40);
    const allowed = step.fixed ?? step.kinds ?? [];
    if (!allowed.includes(kind)) return [];
    return [{
      id: text(l.id, 60) || Math.random().toString(36).slice(2, 10),
      step: step.id, kind, price: price(l.price), price2: step.range ? price(l.price2) : null,
      note: text(l.note, 200), taken: l.taken === true,
    }];
  });
  const htf = obj(r.htf); const draw = obj(r.draw); const plans = obj(r.plans);
  const timing = obj(r.timing); const commit = obj(r.commit);
  const maxTrades = price(commit.maxTrades);
  return {
    steps, ticks, levels,
    htf: {
      bias: oneOf(htf.bias, ['Bullish', 'Bearish', 'Neutral'] as const),
      zone: oneOf(htf.zone, PD_ZONES), priceNow: price(htf.priceNow), note: text(htf.note, 500),
    },
    draw: {
      direction: oneOf(draw.direction, DRAW_DIRECTIONS), target: price(draw.target),
      invalidation: price(draw.invalidation), note: text(draw.note, 500),
    },
    plans: { long: text(plans.long), short: text(plans.short) },
    timing: { note: text(timing.note, 500) },
    commit: {
      maxTrades: maxTrades == null ? null : Math.max(0, Math.round(maxTrades)),
      maxLoss: price(commit.maxLoss) == null ? null : Math.abs(price(commit.maxLoss)!),
    },
  };
}

/** How far through: steps done or skipped, out of all of them. */
export function prepProgress(data: PrepData): { answered: number; done: number; total: number } {
  const states = Object.values(data.steps);
  return { answered: states.length, done: states.filter((s) => s === 'done').length, total: PREP_STEPS.length };
}

/** A level's name on the map: "EQH", "FVG 30,820–30,845", "PDH · swept". */
export function levelLabel(l: PrepLevel): string {
  return [l.kind, l.note].filter(Boolean).join(' · ');
}

/** Every priced level, highest first — the ladder. Zones sort by their top. */
export function ladder(data: PrepData): PrepLevel[] {
  const top = (l: PrepLevel) => Math.max(l.price ?? -Infinity, l.price2 ?? -Infinity);
  return data.levels.filter((l) => l.price != null).sort((a, b) => top(b) - top(a));
}

/** Levels worth carrying into tomorrow: the multi-day ones, not today's session marks. */
export const CARRY_STEPS = ['eqhl', 'gaps', 'zones', 'heatmap'];

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

/** The prep in a few lines of Markdown, for the exports. */
export function prepMarkdown(prep: SessionPrep): string {
  const d = prep.data;
  const out: string[] = [];
  const p = prepProgress(d);
  out.push(`- Prep: ${p.done} of ${p.total} steps marked${p.answered > p.done ? `, ${p.answered - p.done} skipped` : ''}${prep.started_at ? `, started ${prep.started_at.slice(11, 16)} UTC` : ''}`);
  const htf = [d.htf.bias, d.htf.zone && `in ${d.htf.zone.toLowerCase()}`, d.htf.priceNow != null && `price ${fmt(d.htf.priceNow)}`].filter(Boolean).join(', ');
  if (htf || d.htf.note) out.push(`- Higher timeframe: ${htf}${d.htf.note ? ` — ${d.htf.note}` : ''}`);
  if (d.draw.direction || d.draw.target != null) {
    out.push(`- Draw on liquidity: ${d.draw.direction ?? '—'}${d.draw.target != null ? ` to ${fmt(d.draw.target)}` : ''}${d.draw.invalidation != null ? `, wrong above/below ${fmt(d.draw.invalidation)}` : ''}${d.draw.note ? ` — ${d.draw.note}` : ''}`);
  }
  const lv = ladder(d);
  if (lv.length) {
    out.push(`- Levels: ${lv.map((l) => `${l.kind} ${fmt(l.price!)}${l.price2 != null ? `–${fmt(l.price2)}` : ''}${l.taken ? ' (taken)' : ''}${l.note ? ` (${l.note})` : ''}`).join('; ')}`);
  }
  if (d.plans.long.trim()) out.push(`- Long plan: ${d.plans.long.trim().replace(/\s+/g, ' ')}`);
  if (d.plans.short.trim()) out.push(`- Short plan: ${d.plans.short.trim().replace(/\s+/g, ' ')}`);
  if (d.timing.note.trim()) out.push(`- Timing: ${d.timing.note.trim()}`);
  if (d.commit.maxTrades != null || d.commit.maxLoss != null) {
    out.push(`- Committed to: ${[d.commit.maxTrades != null && `at most ${d.commit.maxTrades} trade${d.commit.maxTrades === 1 ? '' : 's'}`, d.commit.maxLoss != null && `stop at −$${fmt(d.commit.maxLoss)}`].filter(Boolean).join(', ')}`);
  }
  return out.join('\n');
}
