import {
  GRADE_MAX, REGRADES, TAKE_IT_THRESHOLD, TRIGGER_KEYS, type Regrade,
} from './domain';
import { CURRENT_RUBRIC, gradeUnder, type GradeInput } from './rubric';

/** What gradeLetter() can return. The checklist's bands produce exactly these. */
export const GRADE_LETTERS = ['A+', 'A', 'B', 'C', 'F'] as const;
export type GradeLetter = (typeof GRADE_LETTERS)[number];

/**
 * Letter from the checklist score alone — the bands, before any gate caps it.
 * For a trade's actual letter use gradeUnder() in lib/rubric.ts.
 *
 * 70 is the line the plan draws: at or above it, with the trigger fired, the
 * trade is a commitment rather than a decision.
 */
export function gradeLetter(score: number): GradeLetter {
  if (score >= 100) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  return 'F';
}

/** Points the trade actually earned, under the current rubric. */
export function checklistEarned(answers: GradeInput): number {
  return gradeUnder(CURRENT_RUBRIC, answers).earned;
}

/**
 * Points that were on the table, under the current rubric.
 *
 * A box answered `null` did not apply on this trade, so its weight is not
 * offered — and cannot be missed. Gates and the trigger are always offered.
 */
export function checklistPossible(answers: GradeInput): number {
  return gradeUnder(CURRENT_RUBRIC, answers).possible;
}

/**
 * The score, as a percentage of what applied, under the current rubric.
 *
 * Kept in step with the identical expression in the schema's generated column,
 * which stays the authority for anything read back out of the database.
 */
export function checklistScore(answers: GradeInput): number {
  return gradeUnder(CURRENT_RUBRIC, answers).score;
}

/** Both Phase 3 answers. Without them the entry does not exist. */
export function triggerFired(answers: GradeInput): boolean {
  return TRIGGER_KEYS.every((key) => answers[key] === true);
}

export const BELOW_STANDARD_AT = TAKE_IT_THRESHOLD;
export const BELOW_STANDARD_PROMPT = 'Below 70. This is not a trade — why are you taking it?';
export const NO_TRIGGER_PROMPT = 'Phase 3 has not fired. This is a setup still forming, not an entry.';

export function isBelowStandard(score: number): boolean {
  return score < TAKE_IT_THRESHOLD;
}

/**
 * A+ mint, A green, B amber, C orange, F red — as CSS variables, because the
 * pastel that reads on near-black is invisible on white. See app/globals.css.
 */
export const GRADE_COLOR: Record<GradeLetter, string> = {
  'A+': 'var(--grade-aplus)',
  A: 'var(--grade-a)',
  B: 'var(--grade-b)',
  C: 'var(--grade-c)',
  F: 'var(--grade-f)',
};

/**
 * Buckets for the plan's own question: is my grading actually predictive? If A+
 * trades do not outperform B trades, the checklist needs changing — not your
 * confidence.
 */
export const GRADE_BUCKETS = [
  { label: 'A+', test: (s: number) => s >= 100 },
  { label: 'A', test: (s: number) => s >= 80 && s < 100 },
  { label: 'B', test: (s: number) => s >= 70 && s < 80 },
  { label: 'C', test: (s: number) => s >= 50 && s < 70 },
  { label: 'F', test: (s: number) => s < 50 },
] as const;

export { GRADE_MAX };

/**
 * The honest re-grade, which can only go down.
 *
 * The re-grade scale has plus and minus steps the entry grade does not; each
 * sits on the same ladder, best first. A re-grade is allowed at the entry
 * letter or anywhere below it — never above. If a C setup won, it was still a
 * C setup, and the one thing a review must not do is launder the result into
 * the grade.
 */
const REGRADE_RANK: Record<Regrade, number> = {
  'A+': 0, A: 1, 'A-': 2, 'B+': 3, B: 4, 'B-': 5, C: 6, F: 7,
};
const LETTER_RANK: Record<GradeLetter, number> = { 'A+': 0, A: 1, B: 4, C: 6, F: 7 };

export const REGRADE_HINT = 'Reviews can only be harsher. If a C setup won, it was still a C setup.';

export function regradeAllowed(entry: GradeLetter, regrade: Regrade): boolean {
  return REGRADE_RANK[regrade] >= LETTER_RANK[entry];
}

/** What the re-grade picker offers for a trade graded `entry`. */
export function regradeOptions(entry: GradeLetter): Regrade[] {
  return REGRADES.filter((r) => regradeAllowed(entry, r));
}
