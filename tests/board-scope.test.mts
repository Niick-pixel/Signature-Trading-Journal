/*
  A dragged group's place belongs to the view it was dragged in.

  The Backtest replay group is the last of five on All and the only group on
  Backtest. One offset shared by both threw it off the screen in the other
  view, and the board looked as if backtests had gone missing.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.SIGNATURE_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'signature-scope-'));
process.env.SIGNATURE_MIGRATIONS_DIR = path.resolve('db/migrations');

const { createTrade } = await import('../db/trades');
const { parseTradeInput } = await import('../lib/validate');
const { computeLayout, offsetSlot, MAX_STRAY } = await import('../lib/layout');
const { readOffsets, writeOffset } = await import('../db/boardlayout');
const { BACKTEST, BACKTEST_REASON } = await import('../lib/domain');

const make = (t: Record<string, unknown>) => {
  const r = parseTradeInput({
    date: '2026-09-20T09:41', instrument: 'NQ', direction: 'Long', session: 'NY AM', reason: 'Rules-based (A+ setup)',
    setup_type: 'iFVG', htf_bias: 'With bias', premium_discount: 'Discount', target_type: 'EQH/EQL',
    outcome: 'Win', r_multiple: 2, account: 'Live', explanation: 'E'.repeat(170), lesson: 'L'.repeat(170),
    screenshot_path: 'x.png', ...t,
  });
  if (!r.ok) throw new Error(r.error);
  return createTrade(r.value);
};

const real = ['Rules-based (A+ setup)', 'Boredom', 'Revenge', 'FOMO'].map((reason) => make({ reason }));
const replays = [1, 2, 3].map(() => make({ account: BACKTEST, reason: BACKTEST_REASON }));
const all = [...real, ...replays];
const at = (l: ReturnType<typeof computeLayout>) => l.clusters.find((c) => c.key === BACKTEST_REASON)!;

test('All keeps the old key; a single account gets its own', () => {
  assert.equal(offsetSlot('reason', 'FOMO'), 'reason::FOMO');
  assert.equal(offsetSlot('reason', 'FOMO', 'All'), 'reason::FOMO');
  assert.equal(offsetSlot('reason', BACKTEST_REASON, BACKTEST), `reason@${BACKTEST}::${BACKTEST_REASON}`);
});

test('a group dragged on Backtest stays put on All, and the other way round', () => {
  const allBase = at(computeLayout(all, 1, 'reason', {}, 'All'));
  const btBase = at(computeLayout(replays, 1, 'reason', {}, BACKTEST));

  // Dragged far on the Backtest board.
  const dragged = { [offsetSlot('reason', BACKTEST_REASON, BACKTEST)]: { dx: 400, dy: 200 } };
  const bt = at(computeLayout(replays, 1, 'reason', dragged, BACKTEST));
  assert.deepEqual([bt.x - btBase.x, bt.y - btBase.y], [400, 200]);
  const onAll = at(computeLayout(all, 1, 'reason', dragged, 'All'));
  assert.deepEqual([onAll.x, onAll.y], [allBase.x, allBase.y], 'the All board ignores the Backtest nudge');

  // And a nudge made on All leaves the Backtest board alone.
  const fromAll = { [offsetSlot('reason', BACKTEST_REASON)]: { dx: -300, dy: 300 } };
  const bt2 = at(computeLayout(replays, 1, 'reason', fromAll, BACKTEST));
  assert.deepEqual([bt2.x, bt2.y], [btBase.x, btBase.y]);
});

test('the store writes each view under its own key', () => {
  writeOffset('reason', BACKTEST_REASON, 40, 0, BACKTEST);
  writeOffset('reason', BACKTEST_REASON, 0, 60);
  const o = readOffsets();
  assert.deepEqual(o[`reason@${BACKTEST}::${BACKTEST_REASON}`], { dx: 40, dy: 0 });
  assert.deepEqual(o[`reason::${BACKTEST_REASON}`], { dx: 0, dy: 60 });
});

test('a stale nudge can never carry a group out of reach', () => {
  const base = computeLayout(all, 1, 'reason', {}, 'All');
  const far = { [offsetSlot('reason', BACKTEST_REASON)]: { dx: 2600, dy: 2200 } };
  const l = computeLayout(all, 1, 'reason', far, 'All');
  const g = at(l);
  const bottom = Math.max(...base.clusters.map((c) => c.y + c.height));
  assert.ok(g.x + g.width <= base.nominalWidth + MAX_STRAY, `x ${g.x}`);
  assert.ok(g.y + g.height <= bottom + MAX_STRAY, `y ${g.y}`);
  // The applied nudge is what it was clamped to, so a drag starts from there.
  assert.deepEqual([g.nudge.dx, g.nudge.dy], [g.x - at(base).x, g.y - at(base).y]);
  // A modest nudge is left exactly as made.
  const near = at(computeLayout(all, 1, 'reason', { [offsetSlot('reason', BACKTEST_REASON)]: { dx: 140, dy: -60 } }, 'All'));
  assert.deepEqual([near.x - at(base).x, near.y - at(base).y], [140, -60]);
});
