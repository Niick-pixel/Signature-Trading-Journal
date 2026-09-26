/*
  R and win-rate arithmetic. A passed setup is journalled but never traded, so
  it must add nothing to R or to the win rate — and still count towards the
  average grade, because how you grade the setups you skip is evidence too.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregate, edge, money } from '../lib/stats';
import type { Trade } from '../lib/types';

const t = (outcome: string, r: number | null, score = 80, extra: Partial<Trade> = {}) =>
  ({ id: Math.random().toString(36), date: '2026-09-01T10:00', outcome, r_multiple: r, checklist_score: score,
    mistake_tags: [], worked_tags: [], pnl_dollars: null, risk_dollars: null, ...extra }) as unknown as Trade;

test('wins and losses sum their R', () => {
  const a = aggregate([t('Win', 2), t('Win', 1.5), t('Loss', -1)]);
  assert.equal(a.totalR, 2.5);
  assert.equal(a.wins, 2);
  assert.equal(a.losses, 1);
  assert.equal(a.winRate, 2 / 3);
});

test('breakeven counts as taken but is neither a win nor a loss', () => {
  const a = aggregate([t('Win', 1), t('Loss', -1), t('Breakeven', 0)]);
  assert.equal(a.taken, 3);
  assert.equal(a.breakeven, 1);
  assert.equal(a.winRate, 0.5);
  assert.equal(a.totalR, 0);
  assert.equal(a.avgR, 0);
});

test('a passed setup adds nothing to R or to the win rate', () => {
  // Even with an R written on it — "what it would have paid" is not paid.
  const base = [t('Win', 2), t('Loss', -1)];
  const withPassed = [...base, t('Not taken', 3), t('Not taken', null)];
  const a = aggregate(base);
  const b = aggregate(withPassed);
  assert.equal(b.totalR, a.totalR);
  assert.equal(b.winRate, a.winRate);
  assert.equal(b.taken, 2);
  assert.equal(b.passed, 2);
  assert.equal(edge(withPassed).expectancy, edge(base).expectancy);
  assert.equal(money(withPassed.map((x) => ({ ...x, pnl_dollars: 100 }))).priced, 2);
});

test('a passed setup still counts towards the average grade', () => {
  const a = aggregate([t('Win', 1, 90), t('Not taken', null, 50)]);
  assert.equal(a.avgGrade, 70);
});

test('expectancy and profit factor', () => {
  const e = edge([t('Win', 3), t('Win', 1), t('Loss', -1), t('Loss', -1)]);
  assert.equal(e.expectancy, 0.5);
  assert.equal(e.profitFactor, 2);
  assert.equal(e.bestR, 3);
  assert.equal(e.worstR, -1);
});

test('nothing settled means no win rate, not zero', () => {
  assert.equal(aggregate([t('Not taken', null)]).winRate, null);
  assert.equal(aggregate([]).avgGrade, null);
});
