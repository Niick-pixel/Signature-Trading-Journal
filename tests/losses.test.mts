/*
  A loss is a negative number, however it was typed or written (migration 020).
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'signature-loss-'));
process.env.SIGNATURE_DATA_DIR = DIR;
process.env.SIGNATURE_MIGRATIONS_DIR = path.resolve('db/migrations');

const { getDb } = await import('../db/index');
const { createTrade, settleTrade, bulkUpdate, getTrade } = await import('../db/trades');
const { parseTradeInput } = await import('../lib/validate');
const { signForOutcome } = await import('../lib/domain');

const input = (t: Record<string, unknown>) => {
  const r = parseTradeInput({
    date: '2026-09-20T09:41', instrument: 'NQ', direction: 'Long', session: 'NY AM', reason: 'Rules-based (A+ setup)',
    setup_type: 'iFVG', htf_bias: 'With bias', premium_discount: 'Discount', target_type: 'Opposing FVG',
    outcome: 'Loss', r_multiple: 1, pnl_dollars: 120, account: 'Live', explanation: 'E'.repeat(170), lesson: 'L'.repeat(170),
    screenshot_path: 'x.png', chk_returned_to_fvg: true, chk_inversion_close: true, ...t,
  });
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

test('the rule: a loss is negated, a win and a breakeven are left alone', () => {
  assert.equal(signForOutcome(120, 'Loss'), -120);
  assert.equal(signForOutcome(-120, 'Loss'), -120);
  assert.equal(signForOutcome(-5, 'Win'), -5);
  assert.equal(signForOutcome(0.3, 'Breakeven'), 0.3);
  assert.equal(signForOutcome(null, 'Loss'), null);
});

test('a loss typed as 120 and 1R is saved as −$120 and −1R', () => {
  getDb();
  const v = input({});
  assert.equal(v.pnl_dollars, -120);
  assert.equal(v.r_multiple, -1);
  const t = createTrade(v);
  assert.equal(getTrade(t.id)!.pnl_dollars, -120);
  assert.equal(getTrade(t.id)!.r_multiple, -1);
});

test('a win is stored as typed', () => {
  const t = createTrade(input({ outcome: 'Win', r_multiple: 2, pnl_dollars: 240 }));
  assert.equal(getTrade(t.id)!.pnl_dollars, 240);
});

test('the database itself refuses a positive loss: a raw write, a bulk edit, a settle', () => {
  const db = getDb();
  const t = createTrade(input({ outcome: 'Win', r_multiple: 2, pnl_dollars: 240 }));
  // A bulk edit that turns a win into a loss.
  bulkUpdate([t.id], { outcome: 'Loss' } as never);
  assert.equal(getTrade(t.id)!.pnl_dollars, -240);
  assert.equal(getTrade(t.id)!.r_multiple, -2);
  // A raw write.
  db.prepare('UPDATE trades SET pnl_dollars = 75 WHERE id = ?').run(t.id);
  assert.equal(getTrade(t.id)!.pnl_dollars, -75);
  // A quick settle with "1".
  const u = createTrade(input({ outcome: 'Win', r_multiple: 1, pnl_dollars: 100 }));
  settleTrade(u.id, { outcome: 'Loss', r_multiple: 1 });
  assert.equal(getTrade(u.id)!.r_multiple, -1);
});
