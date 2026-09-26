/*
  Every migration, in order, against an empty database — the path a first
  launch takes — and the schema it has to end with.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.SIGNATURE_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'signature-mig-'));
const { DatabaseSync } = await import('node:sqlite');
const { migrate } = await import('../db/migrate');
const { MIGRATIONS_DIR } = await import('../lib/paths');
const { checklistScore, gradeLetter, triggerFired } = await import('../lib/grade');

const db = new DatabaseSync(path.join(process.env.SIGNATURE_DATA_DIR!, 'journal.db'));
migrate(db);

const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
const cols = (table: string) => (db.prepare(`PRAGMA table_xinfo(${table})`).all() as Array<{ name: string }>).map((c) => c.name);

test('every migration applies, in order, and is recorded once', () => {
  const applied = (db.prepare('SELECT name FROM schema_migrations ORDER BY name').all() as Array<{ name: string }>).map((r) => r.name);
  assert.deepEqual(applied, files);
});

test('running them again changes nothing', () => {
  migrate(db);
  assert.equal((db.prepare('SELECT count(*) AS n FROM schema_migrations').get() as { n: number }).n, files.length);
});

test('the final schema has every table', () => {
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as Array<{ name: string }>).map((r) => r.name);
  assert.deepEqual(tables, [
    'app_settings', 'board_edges', 'board_notes', 'cash_events', 'daily_reviews', 'flag_dismissals',
    'journal_pages', 'playbooks', 'schema_migrations', 'trade_edits', 'trade_partials', 'trade_screenshots',
    'trades', 'weekly_reviews',
  ]);
});

test('trades carries the frozen grade, quick log and both tag lists', () => {
  const c = cols('trades');
  for (const name of ['rubric_version', 'score_at_entry', 'letter_at_entry', 'trigger_fired_at_entry',
    'quick_log', 'worked_tags', 'mistake_tags', 'followed_rules', 'account', 'deleted_at', 'updated_at']) {
    assert.ok(c.includes(name), name);
  }
  for (const name of ['bias_direction', 'news', 'news_note', 'checked_in_at']) assert.ok(cols('daily_reviews').includes(name), name);
  assert.deepEqual(cols('trade_edits'), ['id', 'trade_id', 'field', 'old_value', 'new_value', 'changed_at']);
});

const insert = (extra: Record<string, unknown>) => {
  const row = {
    id: crypto.randomUUID(), date: '2026-09-26T10:00', instrument: 'NQ', direction: 'Long', session: 'NY AM',
    reason: 'FOMO', setup_type: 'iFVG', htf_bias: 'With bias', premium_discount: 'Discount', target_type: 'Other',
    outcome: 'Loss', explanation: 'x', ...extra,
  };
  const keys = Object.keys(row);
  db.prepare(`INSERT INTO trades (${keys.join(',')}) VALUES (${keys.map((k) => '@' + k).join(',')})`).run(row as never);
  return row.id;
};

test('the schema refuses nothing a journal must accept', () => {
  // A 12-character explanation and no chart: the quick-log shape.
  const id = insert({ explanation: 'Chased again', quick_log: 1 });
  const r = db.prepare('SELECT explanation, screenshot_path FROM trades WHERE id = ?').get(id) as { explanation: string; screenshot_path: string };
  assert.equal(r.explanation, 'Chased again');
  assert.equal(r.screenshot_path, '');
});

test('but still refuses values outside the vocabulary', () => {
  assert.throws(() => insert({ account: 'Bogus' }));
  assert.throws(() => insert({ letter_at_entry: 'Z' }));
});

test('the generated grade columns agree with the app\'s own arithmetic', () => {
  const answers = [
    { chk_htf_bias: 1, chk_killzone: 0, chk_no_news: null, chk_sweep: 1, chk_displacement_fvg: 1, chk_targets_clear: 0, chk_clean_path: null, chk_returned_to_fvg: 1, chk_inversion_close: 1 },
    { chk_htf_bias: 0, chk_killzone: 0, chk_no_news: 0, chk_sweep: 0, chk_displacement_fvg: 0, chk_targets_clear: 0, chk_clean_path: 0, chk_returned_to_fvg: 0, chk_inversion_close: 1 },
    { chk_htf_bias: 1, chk_killzone: 1, chk_no_news: 1, chk_sweep: null, chk_displacement_fvg: 1, chk_targets_clear: 1, chk_clean_path: 1, chk_returned_to_fvg: 1, chk_inversion_close: 1 },
  ];
  for (const a of answers) {
    const id = insert(a);
    const row = db.prepare('SELECT checklist_score, grade_letter, trigger_fired FROM trades WHERE id = ?').get(id) as
      { checklist_score: number; grade_letter: string; trigger_fired: number };
    const js = Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v == null ? null : v === 1]));
    assert.equal(row.checklist_score, checklistScore(js));
    assert.equal(row.grade_letter, gradeLetter(checklistScore(js)));
    assert.equal(Boolean(row.trigger_fired), triggerFired(js));
  }
});

test('the database is intact', () => {
  assert.equal((db.prepare('PRAGMA integrity_check').get() as Record<string, string>).integrity_check, 'ok');
});
