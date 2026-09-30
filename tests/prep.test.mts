/*
  The chart prep and the journal export: the prep document survives any input
  (an earlier version's included), the first save's time is kept, and the
  journal export reads the way it was written.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.SIGNATURE_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'signature-prep-'));
process.env.SIGNATURE_MIGRATIONS_DIR = path.resolve('db/migrations');

const { PREP_STEPS, EMPTY_PREP, parsePrepData, prepProgress, prepMarkdown } = await import('../lib/prep');
const { savePrep, getPrep, previousPrep, listPreps } = await import('../db/prep');
const { toMarkdown } = await import('../lib/sanitise');
const { journalExport } = await import('../lib/journalExport');

test('ten steps of ticks and taps — nothing to type, no overnight sessions', () => {
  assert.equal(PREP_STEPS.length, 10);
  assert.ok(!PREP_STEPS.some((s) => s.id === 'sessions'));
  for (const s of PREP_STEPS) {
    assert.ok(s.marks.length >= 2, s.id);
    for (const f of s.fields) {
      assert.ok(['one', 'many', 'pick'].includes(f.kind), `${s.id}.${f.id}`);
      assert.ok(f.options.length >= 2, `${s.id}.${f.id}`);
    }
  }
  assert.ok(PREP_STEPS.find((s) => s.id === 'heatmap')?.heatmap);
});

test('any input reads as a valid prep; answers outside the options are dropped', () => {
  assert.deepEqual(parsePrepData(null), EMPTY_PREP);
  assert.deepEqual(parsePrepData('garbage'), EMPTY_PREP);
  const d = parsePrepData({
    steps: { htf: 'done', prior: 'skipped', sessions: 'done', eqhl: 'maybe' },
    ticks: { htf: [0, 2, 2, 9, -1, 'x'] },
    answers: {
      'htf.daily': 'Uptrend', 'htf.zone': 'Somewhere', 'prior.taken': ['PDH', 'PWL', 'Nope'],
      'draw.target': 'EQH', 'draw.nope': 'x', 'plan.sweeps': [],
    },
    // What the first version stored: prices and all. Dropped, not refused.
    levels: [{ id: 'a', step: 'eqhl', kind: 'EQH', price: 30906 }], draw: { direction: 'Up', target: 30906 },
  });
  assert.deepEqual(d.steps, { htf: 'done', prior: 'skipped' });
  assert.deepEqual(d.ticks, { htf: [0, 2] });
  assert.deepEqual(d.answers, { 'htf.daily': 'Uptrend', 'prior.taken': ['PDH', 'PWL'], 'draw.target': 'EQH' });
  assert.deepEqual(prepProgress(d), { answered: 2, done: 1, total: 10 });
});

test('saving keeps the first start time and the first finish time', async () => {
  const first = savePrep('2026-09-29', parsePrepData({ steps: { htf: 'done' } }));
  assert.ok(first.started_at);
  assert.equal(first.completed_at, null);
  await new Promise((r) => setTimeout(r, 15));
  const later = savePrep('2026-09-29', parsePrepData({ steps: { htf: 'done', prior: 'done' } }), true);
  assert.equal(later.started_at, first.started_at);
  assert.ok(later.completed_at);
  await new Promise((r) => setTimeout(r, 15));
  const again = savePrep('2026-09-29', later.data, true);
  assert.equal(again.completed_at, later.completed_at);
  assert.equal(getPrep('2026-09-29')!.data.steps.prior, 'done');
  savePrep('2026-09-30', EMPTY_PREP);
  assert.equal(previousPrep('2026-09-30')!.day, '2026-09-29');
  assert.equal(listPreps().length, 2);
});

test('the prep in Markdown says what was answered and marked', () => {
  const md = prepMarkdown({
    day: '2026-09-30', started_at: '2026-09-30T12:10:00.000Z', completed_at: null, updated_at: '',
    data: parsePrepData({
      steps: { htf: 'done', prior: 'skipped' },
      ticks: { htf: [0, 1] },
      answers: { 'htf.daily': 'Uptrend', 'htf.zone': 'Discount', 'draw.direction': 'Up', 'draw.target': 'EQH', 'plan.sweeps': ['Asia high / low', 'PDH / PDL'] },
    }),
  });
  assert.match(md, /1 of 10 steps marked, 1 skipped/);
  assert.match(md, /Higher timeframe: daily Uptrend; price is in Discount · 2\/3 marked/);
  assert.match(md, /Draw on liquidity: price draws Up; first target EQH · 0\/2 marked/);
  assert.match(md, /The plan: sweep to wait for Asia high \/ low, PDH \/ PDL/);
  assert.doesNotMatch(md, /Commit/);
});

test('journal pages keep their shape in Markdown', () => {
  const md = toMarkdown('<h2>Patience</h2><p>I <strong>waited</strong> for the <em>close</em>.</p><ul><li>one</li><li>two</li></ul><ol><li>a</li><li>b</li></ol><blockquote><p>Wait.</p></blockquote><p>Chart <img src="x.png"> &amp; more</p>');
  assert.equal(md, '### Patience\n\nI **waited** for the *close*.\n\n- one\n- two\n\n1. a\n2. b\n\n> Wait.\n\nChart [image] & more');
});

test('the journal export lays each page on its day, with the day beside it', () => {
  const now = new Date('2026-09-30T20:00:00Z');
  const page = (day: string, title: string, body: string, pinned = false) => ({
    id: title, day, title, body, plain: body.replace(/<[^>]*>/g, ''), pinned, created_at: `${day}T20:00:00Z`, updated_at: '',
  });
  const trade = { date: '2026-09-29T09:41:00', instrument: 'NQ', direction: 'Long', setup_type: 'iFVG', grade_letter: 'C',
    outcome: 'Loss', r_multiple: -1, reason: 'FOMO', account: 'Live', mistake_tags: ['Chased'], worked_tags: [],
    lesson: 'Waited for nothing and chased it.' } as never;
  const doc = journalExport({
    range: '30', now,
    pages: [page('2026-09-29', 'Chasing again', '<p>I <strong>chased</strong> the open.</p>'),
      page('2026-01-02', 'My rules', '<p>Only A setups.</p>', true), page('2026-05-01', 'Old', '<p>old</p>')],
    trades: [trade],
    reviews: [{ day: '2026-09-29', checked_in_at: '2026-09-29T12:00:00Z', sleep_hours: 5, state_of_mind: 2, bias_direction: 'Bullish', bias: 'daily FVG', news: 'High', news_note: 'CPI 8:30', trades_planned: 2 } as never],
    preps: [{ day: '2026-09-29', started_at: null, completed_at: null, updated_at: '', data: parsePrepData({ answers: { 'draw.direction': 'Up', 'draw.target': 'EQH' } }) }],
  });
  const md = doc.markdown;
  assert.match(md, /^# My trading journal — last 30 days/);
  assert.match(md, /## For Claude: what this is and what I would like/);
  assert.match(md, /Show me where what I write and what I do disagree/);
  assert.match(md, /### Tuesday 29 September 2026 — 1 page · 1 trade, −1\.0R/);
  assert.match(md, /\*\*Morning:\*\* checked in .* · slept 5h · mind 2\/5 · bias Bullish — daily FVG · news High \(CPI 8:30\) · planned at most 2/);
  assert.match(md, /Draw on liquidity: price draws Up; first target EQH/);
  assert.match(md, /- 09:41 NQ Long · iFVG · grade C · Loss −1\.0R · why: FOMO · Live · went wrong: Chased/);
  assert.match(md, /Lesson: "Waited for nothing and chased it\."/);
  assert.match(md, /#### Page: Chasing again\n\nI \*\*chased\*\* the open\./);
  // Pinned pages from before the range still come along; old unpinned ones do not.
  assert.match(md, /## Pinned pages[\s\S]*My rules/);
  assert.doesNotMatch(md, /Old/);
  assert.equal(doc.pages, 1);
  assert.equal(doc.filename, 'signature-journal-30d-2026-09-30');
});
