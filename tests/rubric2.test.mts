/*
  Migration 015 and the schema it leaves behind.

  An existing journal goes through 015 with every frozen grade untouched, the
  sweep and the single gap backfilled only where the old record said so, the
  renamed target types moved across — and then SQLite's own generated grade
  has to agree with lib/rubric.ts on every checklist there is.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CURRENT_RUBRIC, gradeUnder } from '../lib/rubric';
import type { ChecklistAnswer, SweepTier } from '../lib/domain';

const DIR = path.resolve('db/migrations');
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
const upTo = (db: DatabaseSync, last: string) => {
  for (const f of files) {
    if (f > last) break;
    db.exec('BEGIN'); db.exec(fs.readFileSync(path.join(DIR, f), 'utf8')); db.exec('COMMIT');
  }
};
const fresh = () => new DatabaseSync(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'signature-r2-')), 'journal.db'));

const base = {
  date: '2026-09-20T10:00', instrument: 'NQ', direction: 'Long', session: 'NY AM', reason: 'FOMO',
  setup_type: 'iFVG', htf_bias: 'With bias', premium_discount: 'Discount', outcome: 'Win', explanation: 'x',
};
const insert = (db: DatabaseSync, row: Record<string, unknown>) => {
  const full = { id: crypto.randomUUID(), ...base, ...row };
  const keys = Object.keys(full);
  db.prepare(`INSERT INTO trades (${keys.join(',')}) VALUES (${keys.map((k) => '@' + k).join(',')})`).run(full as never);
  return full.id;
};

test('015 upgrades an existing journal without re-grading anything', () => {
  const db = fresh();
  upTo(db, '014_quick_log_frozen_grade.sql');
  const rows = [
    { chk_sweep: 1, singular_gap: 1, target_type: 'Data wick', score_at_entry: 95, letter_at_entry: 'A+' },
    { chk_sweep: 0, singular_gap: 0, target_type: 'Diagonal trendline', score_at_entry: 72, letter_at_entry: 'B' },
    { chk_sweep: null, singular_gap: 0, target_type: 'Other', score_at_entry: 40, letter_at_entry: 'F' },
    { chk_sweep: 1, singular_gap: 0, target_type: 'Opposing FVG', score_at_entry: 88, letter_at_entry: 'A', status: 'Planned' },
  ];
  const ids = rows.map((r) => insert(db, { ...r, rubric_version: 1, trigger_fired_at_entry: 1, grade_at_entry: r.score_at_entry }));
  db.exec('BEGIN'); db.exec(fs.readFileSync(path.join(DIR, '015_rubric2_gates.sql'), 'utf8')); db.exec('COMMIT');

  const got = ids.map((id) => db.prepare(
    'SELECT sweep_tier, singular_gap, target_type, rubric_version, score_at_entry, letter_at_entry, grade_at_entry, chk_sweep FROM trades WHERE id = ?',
  ).get(id) as Record<string, unknown>);
  // The sweep: a ticked MAJOR box is a major sweep; anything else is unknown, not "none".
  assert.deepEqual(got.map((r) => r.sweep_tier), ['major', null, null, 'major']);
  // The gap: an explicit yes survives; the old pill's default 0 becomes unknown.
  assert.deepEqual(got.map((r) => r.singular_gap), [1, null, null, null]);
  // Renamed targets move; retired ones stay as they were.
  assert.deepEqual(got.map((r) => r.target_type), ['Data wick (ITH/ITL)', 'Trendline/diagonal', 'Other', 'Opposing FVG']);
  // Nothing re-graded, and rubric 1's own box is kept.
  assert.deepEqual(got.map((r) => [r.rubric_version, r.score_at_entry, r.letter_at_entry, r.grade_at_entry]),
    rows.map((r) => [1, r.score_at_entry, r.letter_at_entry, r.score_at_entry]));
  assert.deepEqual(got.map((r) => r.chk_sweep), [1, 0, null, 1]);
  assert.equal((db.prepare('PRAGMA integrity_check').get() as Record<string, string>).integrity_check, 'ok');
});

test('the schema locks the grade at entry once a trade leaves Planned', () => {
  const db = fresh();
  upTo(db, files[files.length - 1]);
  const settled = insert(db, { target_type: 'EQH/EQL', status: 'Settled', score_at_entry: 70, letter_at_entry: 'C', grade_at_entry: 70 });
  const planned = insert(db, { target_type: 'EQH/EQL', status: 'Planned', score_at_entry: 70, letter_at_entry: 'C', grade_at_entry: 70 });
  const run = (sql: string, id: string) => () => db.prepare(sql).run(id);

  for (const col of ['score_at_entry = 99', "letter_at_entry = 'A+'", 'grade_at_entry = 99', 'rubric_version = 3', 'trigger_fired_at_entry = 0']) {
    assert.throws(run(`UPDATE trades SET ${col} WHERE id = ?`, settled), /locked once a trade leaves Planned/, col);
  }
  assert.throws(run("UPDATE trades SET status = 'Planned' WHERE id = ?", settled), /cannot go back/);
  // Writing the same value back is not a change, and everything else stays editable.
  run('UPDATE trades SET score_at_entry = 70, grade_at_entry = 70 WHERE id = ?', settled)();
  run("UPDATE trades SET explanation = 'corrected', chk_killzone = 1, sweep_tier = 'minor' WHERE id = ?", settled)();
  run("UPDATE trades SET status = 'Live' WHERE id = ?", settled)();

  // Planned is still open; leaving it in the same statement as the last re-grade is allowed.
  run("UPDATE trades SET score_at_entry = 91, letter_at_entry = 'A+', grade_at_entry = 91 WHERE id = ?", planned)();
  run("UPDATE trades SET status = 'Settled', score_at_entry = 92, grade_at_entry = 92 WHERE id = ?", planned)();
  assert.throws(run('UPDATE trades SET score_at_entry = 10 WHERE id = ?', planned), /locked/);
  const after = db.prepare('SELECT score_at_entry, letter_at_entry FROM trades WHERE id = ?').get(planned) as Record<string, unknown>;
  assert.deepEqual([after.score_at_entry, after.letter_at_entry], [92, 'A+']);
});

test('the schema refuses a sweep tier or target outside the vocabulary', () => {
  const db = fresh();
  upTo(db, files[files.length - 1]);
  assert.throws(() => insert(db, { target_type: 'EQH/EQL', sweep_tier: 'huge' }));
  assert.throws(() => insert(db, { target_type: 'Diagonal trendline' }));
  assert.throws(() => insert(db, { target_type: 'Trendline/diagonal' }));
  assert.throws(() => insert(db, { target_type: 'EQH/EQL', singular_gap: 2 }));
});

test('016 changes the live A+ line and nothing on record', () => {
  const db = fresh();
  upTo(db, '015_rubric2_gates.sql');
  const perfectBut = {
    target_type: 'EQH/EQL', sweep_tier: 'minor', singular_gap: 1, chk_htf_bias: 1, chk_killzone: 1, chk_no_news: 1,
    chk_displacement_fvg: 1, chk_targets_clear: 1, chk_clean_path: 1, chk_returned_to_fvg: 1, chk_inversion_close: 1,
  };
  const id = insert(db, { ...perfectBut, rubric_version: 2, score_at_entry: 92, letter_at_entry: 'A+', grade_at_entry: 92 });
  assert.equal((db.prepare('SELECT grade_letter FROM trades WHERE id = ?').get(id) as { grade_letter: string }).grade_letter, 'A+');
  db.exec('BEGIN'); db.exec(fs.readFileSync(path.join(DIR, '016_rubric3_perfect_aplus.sql'), 'utf8')); db.exec('COMMIT');
  const r = db.prepare('SELECT grade_letter, letter_at_entry, score_at_entry, deleted_reason FROM trades WHERE id = ?').get(id) as Record<string, unknown>;
  assert.deepEqual([r.grade_letter, r.letter_at_entry, r.score_at_entry, r.deleted_reason], ['A', 'A+', 92, null]);
  // The lock survived the rebuild.
  assert.throws(() => db.prepare("UPDATE trades SET letter_at_entry = 'A' WHERE id = ?").run(id), /locked/);
});

test('SQLite\'s generated grade agrees with lib/rubric.ts on every checklist', () => {
  const db = fresh();
  upTo(db, files[files.length - 1]);
  const tri: Array<number | null> = [1, 0, null];
  const naBoxes = ['chk_htf_bias', 'chk_killzone', 'chk_no_news', 'chk_displacement_fvg', 'chk_targets_clear', 'chk_clean_path'];
  const stmt = db.prepare(`INSERT INTO trades (id, ${Object.keys(base).join(',')}, target_type, sweep_tier, singular_gap,
    chk_returned_to_fvg, chk_inversion_close, ${naBoxes.join(',')})
    VALUES (@id, ${Object.keys(base).map((k) => '@' + k).join(',')}, @target_type, @sweep_tier, @singular_gap,
    @chk_returned_to_fvg, @chk_inversion_close, ${naBoxes.map((k) => '@' + k).join(',')})
    RETURNING checklist_earned, checklist_possible, checklist_score, grade_letter, trigger_fired`);
  const asAnswer = (v: number | null): ChecklistAnswer => (v == null ? null : v === 1);
  let n = 0;
  db.exec('BEGIN');
  const walk = (i: number, boxes: Record<string, number | null>) => {
    if (i < naBoxes.length) {
      for (const v of tri) walk(i + 1, { ...boxes, [naBoxes[i]]: v });
      return;
    }
    for (const sweep of ['major', 'minor', 'none', null] as Array<SweepTier | null>)
      for (const gap of tri)
        for (const [ret, inv] of [[1, 1], [1, 0], [0, 1], [0, 0]])
          for (const target of ['EQH/EQL', 'LRLR (trendline)']) {
            const row = { ...boxes, sweep_tier: sweep, singular_gap: gap, chk_returned_to_fvg: ret, chk_inversion_close: inv, target_type: target };
            const sql = stmt.get({ id: `t${n}`, ...base, ...row } as never) as Record<string, number | string>;
            const js = gradeUnder(CURRENT_RUBRIC, {
              ...Object.fromEntries(Object.entries(boxes).map(([k, v]) => [k, asAnswer(v)])),
              singular_gap: asAnswer(gap), chk_returned_to_fvg: ret === 1, chk_inversion_close: inv === 1,
              sweep_tier: sweep, target_type: target,
            });
            const where = JSON.stringify(row);
            assert.equal(sql.checklist_earned, js.earned, where);
            assert.equal(sql.checklist_possible, js.possible, where);
            assert.equal(sql.checklist_score, js.score, where);
            assert.equal(sql.grade_letter, js.letter, where);
            assert.equal(Boolean(sql.trigger_fired), js.trigger, where);
            n += 1;
          }
  };
  walk(0, {});
  db.exec('ROLLBACK');
  // 3^6 N/A-able boxes x 4 sweeps x 3 gap answers x 4 trigger pairs x 2 targets.
  assert.equal(n, 729 * 4 * 3 * 4 * 2);
});

test('022 renames the old target names and re-grades nothing', () => {
  const db = fresh();
  upTo(db, '021_target_and_management.sql');
  const rows = [
    { target_type: 'Data wick (ITH/ITL)' },
    { target_type: 'Trendline/diagonal' },
    { target_type: 'EQH/EQL' },
    { target_type: 'Opposing FVG' },
  ];
  const ids = rows.map((r) => insert(db, { ...r, sweep_tier: 'major', singular_gap: 1 }));
  const read = () => ids.map((id) => db.prepare(
    'SELECT target_type, checklist_score, grade_letter, score_at_entry FROM trades WHERE id = ?',
  ).get(id) as Record<string, unknown>);
  const before = read();
  db.exec('BEGIN'); db.exec(fs.readFileSync(path.join(DIR, '022_ranked_targets.sql'), 'utf8')); db.exec('COMMIT');
  const after = read();
  assert.deepEqual(after.map((r) => r.target_type), ['Data wick', 'LRLR (trendline)', 'EQH/EQL', 'Opposing FVG']);
  // The trendline cap follows the new name: the grade is what it was.
  assert.deepEqual(after.map((r) => [r.checklist_score, r.grade_letter, r.score_at_entry]),
    before.map((r) => [r.checklist_score, r.grade_letter, r.score_at_entry]));
  for (const t of ['PDH/PDL', 'Weekly high/low', 'Session high/low', 'HTF FVG (1H/4H)', 'ITH/ITL'])
    insert(db, { target_type: t });
});
