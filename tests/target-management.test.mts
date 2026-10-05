/*
  Targets and management (021): five optional answers, a typed max R, and
  the hit-rate split in Stats. Unanswered is unknown, never a miss.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.SIGNATURE_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'signature-tm-'));
process.env.SIGNATURE_MIGRATIONS_DIR = path.resolve('db/migrations');

const { createTrade, getTrade, updateTrade } = await import('../db/trades');
const { parseTradeInput } = await import('../lib/validate');
const { targetHits } = await import('../lib/stats');

const raw = (t: Record<string, unknown> = {}) => ({
  date: '2026-10-01T08:00', instrument: 'NQ', direction: 'Short', session: 'NY AM', reason: 'Rules-based (A+ setup)',
  setup_type: 'iFVG', htf_bias: 'With bias', premium_discount: 'Premium', target_type: 'EQH/EQL',
  outcome: 'Win', r_multiple: 2, account: 'Live', explanation: 'E'.repeat(170), lesson: 'L'.repeat(170),
  screenshot_path: 'x.png', sweep_tier: 'major', singular_gap: true, ...t,
});
const make = (t: Record<string, unknown> = {}) => {
  const r = parseTradeInput(raw(t));
  if (!r.ok) throw new Error(r.error);
  return createTrade(r.value);
};

test('the answers round-trip; never-answered stays null, not "no"', () => {
  const t = make({ target_hit: true, target_fresh: false, opposite_taken: true, mgmt_plan: 'B', partial_at: 'Intraday swing (ITH/ITL)', mfe_r: 2.4 });
  const back = getTrade(t.id)!;
  assert.deepEqual(
    [back.target_hit, back.target_fresh, back.opposite_taken, back.mgmt_plan, back.partial_at, back.mfe_r],
    [true, false, true, 'B', 'Intraday swing (ITH/ITL)', 2.4],
  );
  const blank = make();
  assert.deepEqual([blank.target_hit, blank.target_fresh, blank.opposite_taken, blank.mgmt_plan], [null, null, null, null]);
});

test('a partial level only exists under plan B; junk is dropped, not refused', () => {
  assert.equal(make({ mgmt_plan: 'A', partial_at: 'Intraday swing (ITH/ITL)' }).partial_at, null);
  assert.equal(make({ mgmt_plan: 'Z', partial_at: 'Intraday swing (ITH/ITL)' }).mgmt_plan, null);
  assert.equal(make({ mgmt_plan: 'B', partial_at: 'not a level' }).partial_at, null);
});

test('editing a settled trade can fill the answers in later', () => {
  const t = make();
  const r = parseTradeInput(raw({ target_hit: false, mfe_r: 1.1 }));
  if (!r.ok) throw new Error(r.error);
  const edited = updateTrade(t.id, r.value)!;
  assert.equal(edited.target_hit, false);
  assert.equal(edited.mfe_r, 1.1);
});

test('Stats: hit rate by target type and modifier, unanswered left out', () => {
  const list = [
    make({ target_type: 'EQH/EQL', target_hit: true, target_fresh: true, mfe_r: 3 }),
    make({ target_type: 'EQH/EQL', target_hit: false, target_fresh: false, mfe_r: 1 }),
    make({ target_type: 'PDH/PDL', target_hit: true, target_fresh: true, opposite_taken: true }),
    make({ target_type: 'PDH/PDL' }), // unanswered: not a miss
  ];
  const h = targetHits(list);
  assert.equal(h.answered, 3);
  const eq = h.byType.find((r) => r.key === 'EQH/EQL')!;
  assert.deepEqual([eq.answered, eq.hit, eq.rate], [2, 1, 0.5]);
  const pd = h.byType.find((r) => r.key === 'PDH/PDL')!;
  assert.deepEqual([pd.answered, pd.rate], [1, 1]);
  assert.deepEqual(h.fresh.map((r) => [r.answered, r.hit]), [[2, 2], [1, 0]]);
  assert.deepEqual([h.mfe.n, h.mfe.avg, h.mfe.reached2R], [2, 2, 1]);
});

test('Stats: hit rate by target class, in the expected order, with a disagreement only on real samples', () => {
  const list = [
    make({ target_type: 'Session high/low', target_hit: true }),
    make({ target_type: 'Weekly high/low', target_hit: false }),
    make({ target_type: 'Data wick', target_hit: true }),
    make({ target_type: 'LRLR (trendline)', target_hit: false }),
  ];
  const h = targetHits(list);
  // All six, strongest draw first, each numbered.
  assert.deepEqual(h.byClass.map((r) => r.key), ['external', 'eqhl', 'datawick', 'htf', 'swing', 'lrlr']);
  assert.deepEqual(h.byClass.map((r) => r.rank), [1, 2, 3, 4, 5, 6]);
  // Session and weekly levels count as one class.
  const ext = h.byClass[0];
  assert.deepEqual([ext.answered, ext.hit, ext.rate], [2, 1, 0.5]);
  // Data wick out-hits external here, but on 1 and 2 answers that says nothing.
  assert.equal(h.upset, null);

  // With 20 answers each, an inversion of the ranking is called out.
  const many = [
    ...Array.from({ length: 20 }, (_, i) => ({ ...list[0], target_type: 'PDH/PDL', target_hit: i < 8 })),
    ...Array.from({ length: 20 }, (_, i) => ({ ...list[0], target_type: 'ITH/ITL', target_hit: i < 14 })),
  ];
  assert.deepEqual(targetHits(many).upset, { higher: 'External liquidity', lower: 'Intraday swing' });
});

test('a retired target type still counts, in a row of its own at the end', () => {
  const t = { ...make({ target_hit: true }), target_type: 'Order block' as never };
  const h = targetHits([t]);
  const last = h.byClass[h.byClass.length - 1];
  assert.deepEqual([last.key, last.rank, last.answered], ['other', null, 1]);
});
