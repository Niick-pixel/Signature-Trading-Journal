/*
  The chart prep and the journal export: the prep document survives any input,
  the ladder orders the day, the first save's time is kept, and the journal
  export reads the way it was written.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.SIGNATURE_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'signature-prep-'));
process.env.SIGNATURE_MIGRATIONS_DIR = path.resolve('db/migrations');

const { PREP_STEPS, EMPTY_PREP, parsePrepData, ladder, prepProgress, prepMarkdown } = await import('../lib/prep');
const { savePrep, getPrep, previousPrep, listPreps } = await import('../db/prep');
const { toMarkdown } = await import('../lib/sanitise');
const { journalExport } = await import('../lib/journalExport');

test('eleven steps, each with marks to tick', () => {
  assert.equal(PREP_STEPS.length, 11);
  for (const s of PREP_STEPS) assert.ok(s.marks.length >= 3, s.id);
  assert.ok(PREP_STEPS.find((s) => s.id === 'heatmap')?.heatmap);
  assert.deepEqual(PREP_STEPS.find((s) => s.id === 'eqhl')?.kinds, ['EQH', 'EQL']);
});

test('any input reads as a valid prep, and nothing typed is refused for being half-typed', () => {
  assert.deepEqual(parsePrepData(null), EMPTY_PREP);
  assert.deepEqual(parsePrepData('garbage'), EMPTY_PREP);
  const d = parsePrepData({
    steps: { htf: 'done', prior: 'skipped', nope: 'done', eqhl: 'maybe' },
    ticks: { htf: [0, 2, 2, 9, -1, 'x'] },
    levels: [
      { id: 'a', step: 'eqhl', kind: 'EQH', price: '30906.5', note: 'x'.repeat(500) },
      { id: 'b', step: 'eqhl', kind: 'Bogus', price: 1 },
      { id: 'c', step: 'gaps', kind: 'FVG', price: 30820, price2: '30845' },
      { id: 'd', step: 'prior', kind: 'PDH', price: 'not a number', taken: true },
    ],
    htf: { bias: 'Bullish', zone: 'Premium', priceNow: 30838 },
    commit: { maxTrades: 2.6, maxLoss: -400 },
  });
  assert.deepEqual(d.steps, { htf: 'done', prior: 'skipped' });
  assert.deepEqual(d.ticks, { htf: [0, 2] });
  assert.deepEqual(d.levels.map((l) => [l.kind, l.price, l.price2]), [['EQH', 30906.5, null], ['FVG', 30820, 30845], ['PDH', null, null]]);
  assert.equal(d.levels[0].note.length, 200);
  assert.equal(d.levels[2].taken, true);
  assert.deepEqual([d.htf.bias, d.htf.zone, d.htf.priceNow], ['Bullish', 'Premium', 30838]);
  assert.deepEqual([d.commit.maxTrades, d.commit.maxLoss], [3, 400]);
  assert.deepEqual(prepProgress(d), { answered: 2, done: 1, total: 11 });
});

test('the ladder puts every priced level in order, highest first', () => {
  const d = parsePrepData({ levels: [
    { id: '1', step: 'prior', kind: 'PDL', price: 30511.75 },
    { id: '2', step: 'eqhl', kind: 'EQH', price: 30906 },
    { id: '3', step: 'gaps', kind: 'FVG', price: 30700, price2: 30720 },
    { id: '4', step: 'heatmap', kind: 'Bid wall', price: null },
  ] });
  assert.deepEqual(ladder(d).map((l) => l.kind), ['EQH', 'FVG', 'PDL']);
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

test('the prep in Markdown says the draw, the levels and the plans', () => {
  const md = prepMarkdown({
    day: '2026-09-30', started_at: '2026-09-30T12:10:00.000Z', completed_at: null, updated_at: '',
    data: parsePrepData({
      steps: { htf: 'done', prior: 'skipped' },
      levels: [{ id: '1', step: 'eqhl', kind: 'EQH', price: 30906 }, { id: '2', step: 'prior', kind: 'PDL', price: 30511.75, taken: true }],
      htf: { bias: 'Bullish', zone: 'Discount' },
      draw: { direction: 'Up', target: 30906, invalidation: 30700 },
      plans: { long: 'Sweep of Asia low,\n iFVG long to EQH.' },
      commit: { maxTrades: 2, maxLoss: 400 },
    }),
  });
  assert.match(md, /1 of 11 steps marked, 1 skipped/);
  assert.match(md, /Draw on liquidity: Up to 30,906, wrong above\/below 30,700/);
  assert.match(md, /EQH 30,906; PDL 30,511.75 \(taken\)/);
  assert.match(md, /Long plan: Sweep of Asia low, iFVG long to EQH\./);
  assert.match(md, /at most 2 trades, stop at −\$400/);
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
    preps: [{ day: '2026-09-29', started_at: null, completed_at: null, updated_at: '', data: parsePrepData({ draw: { direction: 'Up', target: 30906 } }) }],
  });
  const md = doc.markdown;
  assert.match(md, /^# My trading journal — last 30 days/);
  assert.match(md, /## For Claude: what this is and what I would like/);
  assert.match(md, /Show me where what I write and what I do disagree/);
  assert.match(md, /### Tuesday 29 September 2026 — 1 page · 1 trade, −1\.0R/);
  assert.match(md, /\*\*Morning:\*\* checked in .* · slept 5h · mind 2\/5 · bias Bullish — daily FVG · news High \(CPI 8:30\) · planned at most 2/);
  assert.match(md, /Draw on liquidity: Up to 30,906/);
  assert.match(md, /- 09:41 NQ Long · iFVG · grade C · Loss −1\.0R · why: FOMO · Live · went wrong: Chased/);
  assert.match(md, /Lesson: "Waited for nothing and chased it\."/);
  assert.match(md, /#### Page: Chasing again\n\nI \*\*chased\*\* the open\./);
  // Pinned pages from before the range still come along; old unpinned ones do not.
  assert.match(md, /## Pinned pages[\s\S]*My rules/);
  assert.doesNotMatch(md, /Old/);
  assert.equal(doc.pages, 1);
  assert.equal(doc.filename, 'signature-journal-30d-2026-09-30');
});
