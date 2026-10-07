import { TARGET_TYPES } from './domain';

/**
 * The chart prep: the second half of the morning check-in, done on the chart
 * before the New York session.
 *
 * Six short steps, each one something the model actually uses — and nothing
 * else (plus the order-book heatmap, kept on purpose):
 *
 *   1. Bias            the HTF direction, and premium or discount
 *   2. Liquidity       the nameable levels a sweep can take
 *   3. HTF gaps        the 1H / 4H FVGs: targets, and deliveries
 *   4. Heatmap         the resting size in the book
 *   5. Draw and plan   which way, to which target class, which side
 *   6. Session         the killzone, the news, the rules for today
 *
 * Order blocks, breakers, support and resistance, NWOG/NDOG and volume
 * imbalances used to have steps of their own. None of them is in the model,
 * so they are gone. (The Asia and London highs and lows are not drawn here
 * on purpose — a TradingView script already draws them.)
 *
 * Each step is at most two marks to tick as they go on the chart and a few
 * answers to tap. Nothing is typed. Like the check-in it is a prompt, never a
 * gate: any step can be skipped and nothing in the app waits on it. Times are
 * New York time, the clock the sessions are defined on.
 */

/** One tap-to-answer question on a step. */
export interface PrepField {
  id: string;
  label: string;
  /** one — a single pill; many — any number of pills; pick — a dropdown. */
  kind: 'one' | 'many' | 'pick';
  options: string[];
}

export interface PrepStep {
  id: string;
  title: string;
  /** The timeframes to look at for this step. */
  frames?: string;
  /** What to draw, one line per mark — each ticked as it goes on the chart. */
  marks: string[];
  fields: PrepField[];
  /** Offers the order-book heatmap link. */
  heatmap?: boolean;
}

/** The nameable levels a sweep can take — the same names the trade form uses. */
const SWEEPABLE = ['PDH', 'PDL', 'PWH', 'PWL', 'Asia high', 'Asia low', 'London high', 'London low', 'EQH', 'EQL'];

export const PREP_STEPS: PrepStep[] = [
  {
    id: 'bias', title: 'Bias', frames: 'Daily · 4H',
    marks: ['Daily / 4H swing range marked, its 50% drawn'],
    fields: [
      { id: 'bias', label: 'HTF bias', kind: 'one', options: ['Bullish', 'Bearish', 'No clear bias'] },
      { id: 'zone', label: 'Price is in', kind: 'one', options: ['Premium', 'Equilibrium', 'Discount'] },
    ],
  },
  {
    id: 'liquidity', title: 'Liquidity to sweep', frames: 'Daily · 1H · 15m',
    marks: ['PDH / PDL and PWH / PWL lined', 'Clean EQH / EQL marked'],
    fields: [
      { id: 'taken', label: 'Already taken', kind: 'many', options: SWEEPABLE },
      { id: 'wait', label: 'Sweep to wait for', kind: 'many', options: SWEEPABLE },
    ],
  },
  {
    id: 'gaps', title: 'HTF gaps', frames: '4H · 1H',
    marks: ['Unfilled 1H and 4H FVGs boxed'],
    fields: [
      { id: 'nearest', label: 'Nearest unfilled HTF FVG', kind: 'one', options: ['Above price', 'Below price', 'Both sides', 'None close'] },
    ],
  },
  {
    id: 'heatmap', title: 'Liquidity from the heatmap', frames: 'Order book', heatmap: true,
    marks: ['Bands that held for hours moved to the chart', 'Flickering bands ignored — spoofing, not liquidity'],
    fields: [
      { id: 'side', label: 'Heaviest liquidity sits', kind: 'one', options: ['Above price', 'Below price', 'Both sides', 'Thin book'] },
      { id: 'walls', label: 'The walls are', kind: 'one', options: ['Holding', 'Being pulled', 'Mixed'] },
    ],
  },
  {
    id: 'draw', title: 'Draw and plan',
    marks: ['Target and invalidation marked', 'Alerts set on the sweep levels'],
    fields: [
      { id: 'direction', label: 'Price draws', kind: 'one', options: ['Up', 'Down', 'Unclear'] },
      // The same six classes the trade form ranks, strongest first.
      { id: 'target', label: 'Target', kind: 'pick', options: [...TARGET_TYPES] },
      { id: 'side', label: 'Today I take', kind: 'one', options: ['Longs only', 'Shorts only', 'Both ways', 'No trade today'] },
    ],
  },
  {
    id: 'session', title: 'Session and rules', frames: 'NY AM',
    marks: ['Killzone shaded, red-folder times lined', 'Only the model: a named sweep, one clean FVG, an inversion close'],
    fields: [
      { id: 'news', label: 'News', kind: 'one', options: ['None today', 'Before the open', 'Inside the killzone'] },
      { id: 'stop', label: 'Stop after', kind: 'one', options: ['1 loss', '2 losses', 'Daily limit'] },
    ],
  },
];

export const PREP_STEP_IDS = PREP_STEPS.map((s) => s.id);

export type StepState = 'done' | 'skipped';
export type Answer = string | string[];

export interface PrepData {
  steps: Record<string, StepState>;
  /** Which marks of each step are on the chart. */
  ticks: Record<string, number[]>;
  /** "step.field" → the answer. */
  answers: Record<string, Answer>;
}

export interface SessionPrep {
  day: string;
  data: PrepData;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export const EMPTY_PREP: PrepData = { steps: {}, ticks: {}, answers: {} };

const obj = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : {});

/**
 * Anything in, a valid prep out. Unknown steps, fields and options are
 * dropped — including whatever an earlier version of the prep stored — and
 * nothing is ever refused.
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
  const answers: Record<string, Answer> = {};
  for (const [key, v] of Object.entries(obj(r.answers))) {
    const [stepId, fieldId] = key.split('.');
    const field = PREP_STEPS.find((s) => s.id === stepId)?.fields.find((f) => f.id === fieldId);
    if (!field) continue;
    if (field.kind === 'many') {
      const list = Array.isArray(v) ? field.options.filter((o) => v.includes(o)) : [];
      if (list.length) answers[key] = list;
    } else if (typeof v === 'string' && field.options.includes(v)) {
      answers[key] = v;
    }
  }
  return { steps, ticks, answers };
}

/** How far through: steps done or skipped, out of all of them. */
export function prepProgress(data: PrepData): { answered: number; done: number; total: number } {
  const states = Object.values(data.steps);
  return { answered: states.length, done: states.filter((s) => s === 'done').length, total: PREP_STEPS.length };
}

export const answerKey = (step: PrepStep, field: PrepField) => `${step.id}.${field.id}`;

/** An answer as words: "PDH, PWL" for a list, the option itself otherwise. */
export function answerText(a: Answer | undefined): string | null {
  if (a == null) return null;
  return Array.isArray(a) ? (a.length ? a.join(', ') : null) : a;
}

/** The prep in a few lines of Markdown, for the exports. */
export function prepMarkdown(prep: SessionPrep): string {
  const d = prep.data;
  const p = prepProgress(d);
  const out: string[] = [];
  out.push(`- Chart prep: ${p.done} of ${p.total} steps marked${p.answered > p.done ? `, ${p.answered - p.done} skipped` : ''}${prep.started_at ? `, started ${prep.started_at.slice(11, 16)} UTC` : ''}`);
  for (const step of PREP_STEPS) {
    const said = step.fields
      .map((f) => [f.label, answerText(d.answers[answerKey(step, f)])] as const)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${k.toLowerCase()} ${v}`);
    const ticked = (d.ticks[step.id] ?? []).length;
    if (!said.length && !ticked) continue;
    out.push(`- ${step.title}: ${said.join('; ')}${said.length ? ' · ' : ''}${ticked}/${step.marks.length} marked`);
  }
  return out.join('\n');
}
