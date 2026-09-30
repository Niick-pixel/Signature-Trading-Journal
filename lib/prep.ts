/**
 * The chart prep: the second half of the morning check-in, done on the chart
 * before the New York session.
 *
 * The check-in's four questions take thirty seconds. This walks the chart
 * top-down in ten short steps — higher timeframe, prior levels, equal highs
 * and lows, gaps, zones, the order-book heatmap, the draw on liquidity, the
 * plan, the timing, the commitment. Each is a few marks to tick as they go on
 * the chart and a few answers to tap. Nothing is typed: the levels belong on
 * the chart, where they are useful, not retyped here where they are not.
 * (The overnight session highs and lows are left out on purpose — a
 * TradingView script already draws them.)
 *
 * Like the check-in it is a prompt, never a gate. Any step can be skipped and
 * nothing in the app waits on it. Times are New York time, the clock the
 * sessions are defined on.
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

const TREND = ['Uptrend', 'Downtrend', 'Range'];

export const PREP_STEPS: PrepStep[] = [
  {
    id: 'htf', title: 'Higher timeframe', frames: 'Daily · 4H',
    marks: [
      'Daily and 4H swing high and low marked',
      'The 50% of that range drawn',
      'Nearest unfilled daily / 4H FVG boxed, above and below',
    ],
    fields: [
      { id: 'daily', label: 'Daily', kind: 'one', options: TREND },
      { id: 'h4', label: '4H', kind: 'one', options: TREND },
      { id: 'zone', label: 'Price is in', kind: 'one', options: ['Premium', 'Equilibrium', 'Discount'] },
    ],
  },
  {
    id: 'prior', title: 'Previous day and week', frames: 'Daily · Weekly',
    marks: ['PDH and PDL lined', 'PWH and PWL lined'],
    fields: [{ id: 'taken', label: 'Already taken', kind: 'many', options: ['PDH', 'PDL', 'PWH', 'PWL'] }],
  },
  {
    id: 'eqhl', title: 'Equal highs and lows', frames: '1H · 15m',
    marks: ['Relative equal highs marked', 'Relative equal lows marked', 'The ones closest to price circled'],
    fields: [{ id: 'nearest', label: 'Clean resting liquidity', kind: 'one', options: ['EQH above', 'EQL below', 'Both sides', 'None clean'] }],
  },
  {
    id: 'gaps', title: 'Important gaps', frames: '4H · 1H · 15m',
    marks: ['Unfilled 1H and 4H FVGs boxed', 'NWOG / NDOG marked', 'Volume imbalances noted'],
    fields: [
      { id: 'types', label: 'On the chart today', kind: 'many', options: ['1H FVG', '4H FVG', 'NWOG', 'NDOG', 'Volume imbalance'] },
      { id: 'nearest', label: 'Nearest unfilled gap', kind: 'one', options: ['Above price', 'Below price', 'Both', 'None close'] },
    ],
  },
  {
    id: 'zones', title: 'Resistance and support', frames: '4H · 1H',
    marks: ['Order blocks and breakers boxed', 'Zones that rejected price twice marked', 'Each labelled resistance or support'],
    fields: [{ id: 'where', label: 'Price is', kind: 'one', options: ['At resistance', 'At support', 'Between zones'] }],
  },
  {
    id: 'heatmap', title: 'Liquidity from the heatmap', frames: 'Order book', heatmap: true,
    marks: ['Heatmap open', 'Bands that held for hours moved to the chart', 'Flickering bands ignored — spoofing, not liquidity'],
    fields: [
      { id: 'side', label: 'Heaviest liquidity sits', kind: 'one', options: ['Above price', 'Below price', 'Both sides', 'Thin book'] },
      { id: 'walls', label: 'The walls are', kind: 'one', options: ['Holding', 'Being pulled', 'Mixed'] },
    ],
  },
  {
    id: 'draw', title: 'Draw on liquidity',
    marks: ['Target level marked on the chart', 'Invalidation level marked'],
    fields: [
      { id: 'direction', label: 'Price draws', kind: 'one', options: ['Up', 'Down', 'Unclear'] },
      {
        id: 'target', label: 'First target', kind: 'pick',
        options: ['PDH', 'PDL', 'PWH', 'PWL', 'Asia high', 'Asia low', 'London high', 'London low', 'EQH', 'EQL', 'FVG', 'Heatmap wall', 'Order block'],
      },
      { id: 'confidence', label: 'How clear', kind: 'one', options: ['Clear', 'Probable', 'Coin flip'] },
    ],
  },
  {
    id: 'plan', title: 'The plan',
    marks: ['Alerts set on the sweep levels', 'Anything outside this plan is not a trade'],
    fields: [
      { id: 'side', label: 'Today I take', kind: 'one', options: ['Longs only', 'Shorts only', 'Both ways', 'No trade today'] },
      { id: 'sweeps', label: 'Sweep to wait for', kind: 'many', options: ['Asia high / low', 'London high / low', 'PDH / PDL', 'EQH / EQL', 'Heatmap wall', 'Opening range'] },
    ],
  },
  {
    id: 'timing', title: 'News and timing',
    marks: ['Red-folder release times lined', 'New York AM killzone shaded'],
    fields: [
      { id: 'first', label: 'First entry', kind: 'pick', options: ['From the open (9:30)', 'After 9:45', 'After 10:00', '15 min after the news'] },
      { id: 'done', label: 'Done by', kind: 'pick', options: ['11:00', '11:30', '12:00', 'The close'] },
    ],
  },
  {
    id: 'commit', title: 'Commit',
    marks: [
      'Only the model: a nameable sweep, one clean gap, an inversion close',
      'Stop after two losses',
      'Daily loss limit set in the platform',
      'Step away until an alert rings',
    ],
    fields: [],
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
