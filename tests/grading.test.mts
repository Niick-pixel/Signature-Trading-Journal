/*
  The grading arithmetic. Sizing decisions rest on these numbers, so every
  rule the plan states is pinned here: the score, the trigger, the letter
  bands at their exact boundaries, and the frozen rubric agreeing with all of it.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { checklistScore, gradeLetter, triggerFired } from '../lib/grade';
import { CHECKLIST_ITEMS, CHECKLIST_KEYS, type ChecklistAnswer, type ChecklistKey } from '../lib/domain';
import { CURRENT_RUBRIC, RUBRICS, gradeUnder } from '../lib/rubric';

type Answers = Record<ChecklistKey, ChecklistAnswer>;
const every = (v: ChecklistAnswer): Answers =>
  Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, v])) as Answers;

test('all boxes off scores 0 and grades F', () => {
  assert.equal(checklistScore(every(false)), 0);
  assert.equal(gradeLetter(checklistScore(every(false))), 'F');
});

test('all boxes on scores 100 and grades A+', () => {
  assert.equal(checklistScore(every(true)), 100);
  assert.equal(gradeLetter(checklistScore(every(true))), 'A+');
});

test('the weights add to 100', () => {
  assert.equal(CHECKLIST_ITEMS.reduce((s, i) => s + i.points, 0), 100);
});

test('only the trigger ticked scores its 20 points', () => {
  const a = { ...every(false), chk_returned_to_fvg: true, chk_inversion_close: true };
  assert.equal(checklistScore(a), 20);
});

test('a box marked N/A leaves the denominator instead of counting as a miss', () => {
  // No major level to sweep: graded out of 80, and still a perfect trade.
  assert.equal(checklistScore({ ...every(true), chk_sweep: null }), 100);
  // Out of 80 with the killzone (10) missed: 70/80 = 87.5, rounds to 88.
  assert.equal(checklistScore({ ...every(true), chk_sweep: null, chk_killzone: false }), 88);
  // Nothing applied at all is 0, not a division by zero.
  const none = { ...every(null), chk_returned_to_fvg: false, chk_inversion_close: false };
  assert.equal(checklistScore(none), 0);
});

test('the trigger fires only when both Phase 3 boxes are ticked', () => {
  for (const [ret, inv, fired] of [[true, true, true], [true, false, false], [false, true, false], [false, false, false]] as const) {
    assert.equal(triggerFired({ ...every(true), chk_returned_to_fvg: ret, chk_inversion_close: inv }), fired, `${ret}/${inv}`);
  }
});

test('letter thresholds at every boundary', () => {
  const cases: Array<[number, string]> = [
    [0, 'F'], [49, 'F'], [50, 'C'], [69, 'C'], [70, 'B'], [79, 'B'], [80, 'A'], [89, 'A'], [90, 'A+'], [100, 'A+'],
  ];
  for (const [score, letter] of cases) assert.equal(gradeLetter(score), letter, `score ${score}`);
});

test('the current rubric version is exactly the live checklist', () => {
  // Changing a weight without adding a rubric version fails here, on purpose:
  // it would re-grade every trade ever logged. See db/RUBRIC.md.
  const rubric = RUBRICS[CURRENT_RUBRIC];
  for (const item of CHECKLIST_ITEMS) assert.equal(rubric.weights[item.key], item.points, item.key);
  for (const score of [0, 49, 50, 69, 70, 79, 80, 89, 90, 100]) {
    assert.equal(rubric.letters.find(([min]) => score >= min)?.[1], gradeLetter(score), `score ${score}`);
  }
});

test('the frozen grade agrees with the live one on every possible checklist', () => {
  // 3^7 tri-state boxes x 2^2 trigger boxes = 8,748 checklists.
  const tri: ChecklistAnswer[] = [true, false, null];
  const keys = CHECKLIST_ITEMS.filter((i) => i.canBeNA).map((i) => i.key);
  let n = 0;
  const walk = (i: number, a: Partial<Answers>) => {
    if (i === keys.length) {
      for (const ret of [true, false]) for (const inv of [true, false]) {
        const full = { ...a, chk_returned_to_fvg: ret, chk_inversion_close: inv } as Answers;
        const g = gradeUnder(CURRENT_RUBRIC, full);
        assert.equal(g.score, checklistScore(full));
        assert.equal(g.letter, gradeLetter(checklistScore(full)));
        assert.equal(g.trigger, triggerFired(full));
        n += 1;
      }
      return;
    }
    for (const v of tri) walk(i + 1, { ...a, [keys[i]]: v });
  };
  walk(0, {});
  assert.equal(n, 8748);
});

test('an old rubric version keeps grading the old way after a new one is added', () => {
  // A pretend version 2 that doubles the sweep. Version 1 must be unmoved by it.
  const v2 = { ...RUBRICS[1], version: 2, weights: { ...RUBRICS[1].weights, chk_sweep: 40 } };
  RUBRICS[2] = v2;
  try {
    const a = { ...every(true), chk_sweep: false };
    assert.equal(gradeUnder(1, a).score, 80);
    assert.equal(gradeUnder(2, a).score, Math.round((80 * 100) / 120));
  } finally {
    delete RUBRICS[2];
  }
});
