import type { Outcome } from './domain';
import type { Trade } from './types';

/**
 * What I told myself last time.
 *
 * Every trade carries a written lesson — 160 characters at least — and until
 * now a lesson was only ever read again by opening the one trade it was
 * written on. The form now shows the most recent lessons from the same kind of
 * setup, at the moment of planning the next one: not a gate, just the thing I
 * already wrote, put back in front of me before the entry rather than after.
 */
export interface PastLesson {
  id: string;
  date: string;
  outcome: Outcome;
  r_multiple: number | null;
  lesson: string;
}

/** How many a setup shows. Three is a glance; ten is a reading assignment. */
const KEEP = 3;

/**
 * The latest lessons for each setup type.
 *
 * `before` is the trade being edited, if any. Editing an old trade should show
 * what came BEFORE it, not lessons learned afterwards — reading next month's
 * lesson onto this month's trade is exactly the hindsight the Planned stage
 * exists to keep out. That filter has to run before the cap, or an old trade's
 * three slots are filled by newer lessons and then filtered down to nothing.
 */
export function lessonsBySetup(
  trades: Trade[], before?: { id: string; date: string },
): Record<string, PastLesson[]> {
  const out: Record<string, PastLesson[]> = {};
  const newestFirst = trades
    .filter((t) => !before || (t.id !== before.id && t.date < before.date))
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const t of newestFirst) {
    const lesson = t.lesson?.trim();
    if (!lesson) continue;
    const list = (out[t.setup_type] ??= []);
    if (list.length >= KEEP) continue;
    list.push({ id: t.id, date: t.date, outcome: t.outcome, r_multiple: t.r_multiple, lesson });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Lessons I keep writing.
 * ------------------------------------------------------------------ */

/**
 * A lesson written more than once is not a lesson, it is a habit — and a habit
 * the checklist has no box for, because I only ever described it in words. The
 * mistake tags catch the ones I thought to name; this catches the ones I keep
 * writing out longhand without noticing it is the fourth time.
 *
 * Matching is by shared meaningful words, not by meaning. That is deliberate:
 * it is crude, it runs offline, and every group it shows can be checked by
 * reading it — the words that tied a group together are shown with it.
 */
export interface LessonGroup {
  /** The words most of the group has in common, most shared first. */
  shared: string[];
  lessons: PastLesson[];
  /** R across the taken trades in the group. */
  totalR: number;
}

const STOP = new Set(`
  the a an and or but if then than that this those these there their they them
  was were is are be been being have has had do did does not no nor too very
  for from with without into onto over under about above below after before
  again once just only also still even more most less least much many some any
  all each every other such same own so as at by in of on to up out off down
  it its i im me my mine we our you your he she his her what when where which
  who why how will would should could can may might must shall
  trade trades trading setup time today day next last got get went going
  really because thing things way lot bit
`.split(/\s+/).filter(Boolean));

/** Close enough that "entered", "entering" and "entry" are one word. */
function stem(w: string): string {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  if (w.length > 4 && w.endsWith('y')) return w.slice(0, -1);
  return w;
}

/**
 * Each meaningful word, keyed by its stem, with the word as it was written.
 * Matching uses the stem; anything shown to a person uses the word — a tag
 * reading "actuall" is the stemmer talking, not the journal.
 */
/**
 * The same thing, spelled the ways a trader actually spells it. Without this,
 * "break even", "break-even" and "BE" are three different words and the same
 * lesson written three ways never meets itself.
 */
const PHRASES: Array<[RegExp, string]> = [
  [/\bbreak[\s-]?even\b|\bb\/e\b|\bbe\b(?=\s+(?:too|early|stop))/g, 'breakeven'],
  [/\bstop[\s-]?loss(?:es)?\b|\bsl\b/g, 'stop'],
  [/\btake[\s-]?profits?\b|\btp\b/g, 'target'],
  [/\bfair[\s-]?value[\s-]?gaps?\b|\bfvgs\b/g, 'fvg'],
  [/\binverse\s+fvg\b|\bifvgs?\b/g, 'ifvg'],
];

export function lessonTokens(text: string): Map<string, string> {
  const out = new Map<string, string>();
  let normal = text.toLowerCase();
  for (const [pattern, word] of PHRASES) normal = normal.replace(pattern, word);
  for (const w of normal.replace(/[^a-z\s]/g, ' ').split(/\s+/)) {
    // Real words only: a 200-letter run of one character is filler, not a word.
    if (w.length < 3 || w.length > 18 || STOP.has(w) || new Set(w).size < 2) continue;
    const root = stem(w);
    if (root.length < 3 || STOP.has(root)) continue;
    if (!out.has(root)) out.set(root, w);
  }
  return out;
}

export function lessonWords(text: string): Set<string> {
  return new Set(lessonTokens(text).keys());
}

/*
  Tuned on lessons at the app's real 160-character minimum, where the same
  mistake written again shared 5 to 9 meaningful words and two different
  lessons — deliberately full of the same trading vocabulary — shared at most
  4. The word count is what separates them; the ratio is only a guard against
  two very long lessons meeting on five generic words.
*/
/** Share at least this many meaningful words… */
const MIN_SHARED = 5;
/** …making up at least this much of the shorter lesson. */
const MIN_OVERLAP = 0.25;

export function similar(a: Set<string>, b: Set<string>): boolean {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared >= MIN_SHARED && shared / Math.min(a.size, b.size) >= MIN_OVERLAP;
}

export function repeatedLessons(trades: Trade[]): LessonGroup[] {
  const items = trades
    .flatMap((t) => {
      const text = t.lesson?.trim();
      if (!text) return [];
      const tokens = lessonTokens(text);
      return [{
        lesson: { id: t.id, date: t.date, outcome: t.outcome, r_multiple: t.r_multiple, lesson: text } as PastLesson,
        words: new Set(tokens.keys()),
        tokens,
      }];
    })
    // Too few real words to compare on means too few to group on.
    .filter((x) => x.words.size >= MIN_SHARED);

  // Union-find over every similar pair.
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (similar(items[i].words, items[j].words)) parent[find(i)] = find(j);
    }
  }

  const byRoot = new Map<number, typeof items>();
  items.forEach((x, i) => {
    const root = find(i);
    byRoot.set(root, [...(byRoot.get(root) ?? []), x]);
  });

  return [...byRoot.values()]
    .filter((g) => g.length >= 2)
    .map((g) => {
      const counts = new Map<string, number>();
      // Per stem, how often each written form was used — the commonest is shown.
      const forms = new Map<string, Map<string, number>>();
      for (const x of g) {
        for (const [root, word] of x.tokens) {
          counts.set(root, (counts.get(root) ?? 0) + 1);
          const f = forms.get(root) ?? new Map<string, number>();
          f.set(word, (f.get(word) ?? 0) + 1);
          forms.set(root, f);
        }
      }
      const shown = (root: string) =>
        [...(forms.get(root) ?? new Map([[root, 1]]))].sort((a, b) => b[1] - a[1])[0][0];
      const shared = [...counts]
        .filter(([, n]) => n >= Math.max(2, Math.ceil(g.length / 2)))
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 5)
        .map(([root]) => shown(root));
      const lessons = g.map((x) => x.lesson).sort((a, b) => b.date.localeCompare(a.date));
      const totalR = lessons
        .filter((l) => l.outcome !== 'Not taken')
        .reduce((s, l) => s + (l.r_multiple ?? 0), 0);
      return { shared, lessons, totalR };
    })
    .sort((a, b) => b.lessons.length - a.lessons.length || b.lessons[0].date.localeCompare(a.lessons[0].date));
}
