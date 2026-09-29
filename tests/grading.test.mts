/*
  The grading arithmetic. Sizing decisions rest on these numbers, so every
  rule the plan states is pinned here: the score, the sweep tiers, the gates,
  the diagonal cap, the trigger, the letter bands at their exact boundaries,
  the harsher-only re-grade, and the frozen rubric agreeing with all of it.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { checklistScore, gradeLetter, regradeAllowed, regradeOptions, triggerFired } from '../lib/grade';
import {
  CHECKLIST_ITEMS, CHECKLIST_KEYS, CHECKLIST_PHASES, GATE_KEYS, GRADE_MAX, REGRADES, SWEEP_TIER_SPEC,
  TRIGGER_KEYS, type ChecklistAnswer, type ChecklistKey,
} from '../lib/domain';
import { CURRENT_RUBRIC, RUBRICS, gradeUnder, type GradeInput } from '../lib/rubric';

type Answers = Record<ChecklistKey, ChecklistAnswer>;
const every = (v: ChecklistAnswer): Answers =>
  Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, v])) as Answers;
/** A textbook trade: every box, a major sweep, a named target. */
const perfect: GradeInput = { ...every(true), sweep_tier: 'major', target_type: 'EQH/EQL' };
const grade = (a: GradeInput) => gradeUnder(CURRENT_RUBRIC, a);

test('the current rubric is version 3', () => {
  assert.equal(CURRENT_RUBRIC, 3);
});

test('the weights add to 100: Prep 25, Setup 55, Trigger 20', () => {
  assert.equal(GRADE_MAX, 100);
  const phase = (i: number) => CHECKLIST_PHASES[i].items.reduce((s, item) => s + item.points, 0);
  assert.deepEqual([phase(0), phase(1), phase(2)], [25, 55, 20]);
  const w = RUBRICS[3].weights;
  assert.deepEqual(
    [w.chk_htf_bias, w.chk_killzone, w.chk_no_news, w.singular_gap, w.chk_displacement_fvg,
      w.chk_targets_clear, w.chk_clean_path, w.chk_returned_to_fvg, w.chk_inversion_close],
    [10, 10, 5, 10, 10, 10, 5, 5, 15]);
  assert.deepEqual(RUBRICS[3].sweep, { major: 20, minor: 12, none: 0 });
});

test('nothing answered scores 0 and grades F', () => {
  const g = grade({ ...every(false), sweep_tier: 'none', target_type: 'EQH/EQL' });
  assert.equal(g.score, 0);
  assert.equal(g.letter, 'F');
});

test('a textbook trade scores 100 and grades A+', () => {
  const g = grade(perfect);
  assert.equal(g.score, 100);
  assert.equal(g.letter, 'A+');
  assert.deepEqual(g.caps, []);
});

test('the sweep tier is worth 20, 12 or nothing', () => {
  assert.equal(grade({ ...perfect, sweep_tier: 'major' }).earned, 100);
  assert.equal(grade({ ...perfect, sweep_tier: 'minor' }).earned, 92);
  assert.equal(grade({ ...perfect, sweep_tier: 'none' }).earned, 80);
  // A minor but nameable sweep passes the gate — but 92 is not perfect, so A.
  assert.equal(grade({ ...perfect, sweep_tier: 'minor' }).letter, 'A');
});

test('GATE: no nameable sweep caps the grade at C, whatever the total', () => {
  const g = grade({ ...perfect, sweep_tier: 'none' });
  assert.equal(g.score, 80);
  assert.equal(g.letter, 'C');
  assert.equal(g.caps[0].id, 'model');
  assert.equal(g.caps[0].message, 'Gate failed — this is not the model. Max grade C.');
  // Unanswered is not passed.
  assert.equal(grade({ ...perfect, sweep_tier: null }).letter, 'C');
  assert.equal(grade({ ...perfect, sweep_tier: undefined }).letter, 'C');
});

test('GATE: anything but one clean gap caps the grade at C', () => {
  const g = grade({ ...perfect, singular_gap: false });
  assert.equal(g.score, 90);
  assert.equal(g.letter, 'C');
  // A gate cannot be N/A: unanswered stays in the denominator and fails.
  const unanswered = grade({ ...perfect, singular_gap: null });
  assert.equal(unanswered.possible, 100);
  assert.equal(unanswered.letter, 'C');
});

test('a gate is a ceiling, not a floor: a failing score stays F', () => {
  const g = grade({ ...every(false), chk_returned_to_fvg: true, chk_inversion_close: true, sweep_tier: 'none' });
  assert.equal(g.score, 20);
  assert.equal(g.letter, 'F');
});

test('a Trendline/diagonal target caps the grade at B', () => {
  assert.equal(grade({ ...perfect, target_type: 'Trendline/diagonal' }).letter, 'B');
  // Under B already, it changes nothing.
  assert.equal(grade({ ...perfect, target_type: 'Trendline/diagonal', chk_htf_bias: false, chk_killzone: false, chk_no_news: false }).letter, 'B');
  // With a failed gate too, the stricter cap wins.
  const both = grade({ ...perfect, target_type: 'Trendline/diagonal', singular_gap: false });
  assert.equal(both.letter, 'C');
  assert.deepEqual(both.caps.map((c) => c.id), ['model', 'diagonal']);
});

test('a box marked N/A leaves the denominator; the gates and the trigger never do', () => {
  // No news calendar to check: graded out of 95, still perfect.
  assert.equal(grade({ ...perfect, chk_no_news: null }).score, 100);
  // Out of 95 with the killzone (10) missed: 85/95 = 89.5, rounds to 89.
  assert.equal(grade({ ...perfect, chk_no_news: null, chk_killzone: false }).score, 89);
  assert.deepEqual(CHECKLIST_ITEMS.filter((i) => !i.canBeNA).map((i) => i.key).sort(),
    [...GATE_KEYS, ...TRIGGER_KEYS].sort());
});

test('the trigger fires only when both Phase 3 boxes are ticked', () => {
  for (const [ret, inv, fired] of [[true, true, true], [true, false, false], [false, true, false], [false, false, false]] as const) {
    assert.equal(triggerFired({ ...perfect, chk_returned_to_fvg: ret, chk_inversion_close: inv }), fired, `${ret}/${inv}`);
  }
});

test('letter bands at every boundary', () => {
  const cases: Array<[number, string]> = [
    [0, 'F'], [49, 'F'], [50, 'C'], [69, 'C'], [70, 'B'], [79, 'B'], [80, 'A'], [89, 'A'], [90, 'A'], [99, 'A'], [100, 'A+'],
  ];
  for (const [score, letter] of cases) assert.equal(gradeLetter(score), letter, `score ${score}`);
});

test('A+ is a perfect trade and nothing less', () => {
  assert.equal(grade(perfect).letter, 'A+');
  assert.equal(grade({ ...perfect, chk_clean_path: false }).letter, 'A'); // 95
  // A box that did not apply is not a point missed: 100% of what applied is still perfect.
  assert.equal(grade({ ...perfect, chk_no_news: null }).letter, 'A+');
});

test('rubric 2 keeps its own bands: 92 was an A+ there, and stays one', () => {
  assert.equal(gradeUnder(2, { ...perfect, sweep_tier: 'minor' }).letter, 'A+');
  assert.equal(gradeUnder(2, { ...perfect, sweep_tier: 'none' }).letter, 'C');
});

test('the current rubric version is exactly the live checklist', () => {
  // Changing a weight without adding a rubric version fails here, on purpose:
  // it would re-grade every trade ever logged. See db/RUBRIC.md.
  const rubric = RUBRICS[CURRENT_RUBRIC];
  for (const item of CHECKLIST_ITEMS) assert.equal(rubric.weights[item.key], item.points, item.key);
  assert.equal(Object.keys(rubric.weights).length, CHECKLIST_ITEMS.length);
  for (const [tier, spec] of Object.entries(SWEEP_TIER_SPEC)) {
    assert.equal(rubric.sweep?.[tier as keyof typeof SWEEP_TIER_SPEC], spec.points, tier);
  }
  for (const score of [0, 49, 50, 69, 70, 79, 80, 89, 90, 99, 100]) {
    assert.equal(rubric.letters.find(([min]) => score >= min)?.[1], gradeLetter(score), `score ${score}`);
  }
});

test('the form helpers are the rubric', () => {
  for (const a of [perfect, { ...perfect, sweep_tier: 'minor' as const, chk_clean_path: null }, every(false)]) {
    assert.equal(checklistScore(a), grade(a).score);
  }
});

test('rubric 1 still grades exactly as it did: no tiers, no gates, no caps', () => {
  const v1 = { ...every(true), chk_sweep: true, singular_gap: false, sweep_tier: 'none' as const, target_type: 'Trendline/diagonal' };
  const g = gradeUnder(1, v1);
  assert.deepEqual([g.score, g.letter, g.caps.length], [100, 'A+', 0]);
  // Its own weights: the MAJOR box 20, the FVG and targets 15.
  assert.equal(gradeUnder(1, { ...v1, chk_sweep: false }).score, 80);
  assert.equal(gradeUnder(1, { ...v1, chk_sweep: null }).score, 100);
  assert.equal(gradeUnder(1, { ...v1, chk_sweep: null, chk_killzone: false }).score, 88);
  assert.equal(gradeUnder(1, { ...v1, chk_displacement_fvg: false }).score, 85);
});

test('re-grades can only be harsher', () => {
  assert.deepEqual(regradeOptions('A+'), [...REGRADES]);
  assert.deepEqual(regradeOptions('A'), ['A', 'A-', 'B+', 'B', 'B-', 'C', 'F']);
  assert.deepEqual(regradeOptions('B'), ['B', 'B-', 'C', 'F']);
  assert.deepEqual(regradeOptions('C'), ['C', 'F']);
  assert.deepEqual(regradeOptions('F'), ['F']);
  assert.equal(regradeAllowed('C', 'B'), false);
  assert.equal(regradeAllowed('B', 'B+'), false);
  assert.equal(regradeAllowed('B', 'B-'), true);
});
