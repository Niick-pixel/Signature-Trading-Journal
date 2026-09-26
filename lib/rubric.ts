import { CHECKLIST_ITEMS, TRIGGER_KEYS, type ChecklistAnswer, type ChecklistKey } from './domain';
import type { GradeLetter } from './grade';

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
 * CHECKLIST_ITEMS — so editing the live checklist can never move an old
 * version. To change a weight or a letter band: add a version here, raise
 * CURRENT_RUBRIC, update the checklist and the generated columns to match, and
 * record it in db/RUBRIC.md. The test suite fails if the live checklist and
 * the current version disagree.
 */

export interface Rubric {
  version: number;
  /** When it came into force, for db/RUBRIC.md. */
  since: string;
  weights: Record<ChecklistKey, number>;
  /** Lowest score for each letter, best first. */
  letters: ReadonlyArray<readonly [number, GradeLetter]>;
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
};

export const CURRENT_RUBRIC = 1;

export interface FrozenGrade { score: number; letter: GradeLetter; trigger: boolean }

type Answers = Partial<Record<ChecklistKey, ChecklistAnswer>>;

/**
 * The grade a set of answers gets under one rubric version. A box answered
 * null did not apply: its weight is neither offered nor missed, exactly as the
 * generated columns do it. An unknown version grades under the oldest one
 * rather than throwing — a trade must always be readable.
 */
export function gradeUnder(version: number, answers: Answers): FrozenGrade {
  const rubric = RUBRICS[version] ?? RUBRICS[1];
  let earned = 0;
  let possible = 0;
  for (const item of CHECKLIST_ITEMS) {
    const w = rubric.weights[item.key] ?? 0;
    const a = answers[item.key];
    if (a === null) continue;
    possible += w;
    if (a === true) earned += w;
  }
  const score = possible === 0 ? 0 : Math.round((earned * 100) / possible);
  const letter = rubric.letters.find(([min]) => score >= min)?.[1] ?? 'F';
  const trigger = TRIGGER_KEYS.every((k) => answers[k] === true);
  return { score, letter, trigger };
}
