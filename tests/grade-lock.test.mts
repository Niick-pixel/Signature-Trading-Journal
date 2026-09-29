/*
  The grade at entry, the stage and the re-grade, through the app's own data
  layer and validation — the paths the form and the API actually take.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

process.env.SIGNATURE_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'signature-lock-'));
process.env.SIGNATURE_MIGRATIONS_DIR = path.resolve('db/migrations');

const { createTrade, updateTrade, settleTrade, bulkUpdate, getTrade, tradeHistory, listTrades, softDeleteTrade, restoreTrade } = await import('../db/trades');
const { parseTradeInput } = await import('../lib/validate');
const { modelBreakdowns } = await import('../lib/stats');
const { adherenceOf } = await import('../lib/adherence');
const exportRoute = await import('../app/api/export/route');

/** Enough of a ZIP reader to pull one file out of the export. */
function unzip(buf: Buffer, want: string): Buffer {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let at = buf.readUInt32LE(eocd + 16);
  const count = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(at + 10);
    const size = buf.readUInt32LE(at + 20);
    const nameLen = buf.readUInt16LE(at + 28);
    const extra = buf.readUInt16LE(at + 30);
    const comment = buf.readUInt16LE(at + 32);
    const local = buf.readUInt32LE(at + 42);
    const name = buf.subarray(at + 46, at + 46 + nameLen).toString('utf8');
    if (name === want) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const body = buf.subarray(start, start + size);
      return method === 8 ? inflateRawSync(body) : body;
    }
    at += 46 + nameLen + extra + comment;
  }
  throw new Error(`${want} not in the zip`);
}

const raw = (t: Record<string, unknown> = {}) => ({
  date: '2026-09-29T09:41', instrument: 'NQ', direction: 'Long', session: 'NY AM', reason: 'Rules-based (A+ setup)',
  setup_type: 'iFVG', htf_bias: 'With bias', premium_discount: 'Discount', target_type: 'EQH/EQL',
  outcome: 'Win', r_multiple: 2, account: 'Live', explanation: 'E'.repeat(170), lesson: 'L'.repeat(170),
  screenshot_path: 'x.png',
  chk_htf_bias: true, chk_killzone: true, chk_no_news: true, sweep_tier: 'major', singular_gap: true,
  chk_displacement_fvg: true, chk_targets_clear: true, chk_clean_path: true,
  chk_returned_to_fvg: true, chk_inversion_close: true,
  ...t,
});
const input = (t: Record<string, unknown> = {}, floor = {}) => {
  const r = parseTradeInput(raw(t), floor);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

test('a new trade is graded under the current rubric, gates and all', () => {
  const a = createTrade(input());
  assert.deepEqual([a.rubric_version, a.checklist_score, a.grade_letter, a.grade_at_entry], [3, 100, 'A+', 100]);
  const gated = createTrade(input({ sweep_tier: 'none' }));
  assert.deepEqual([gated.checklist_score, gated.grade_letter], [80, 'C']);
  const stacked = createTrade(input({ singular_gap: false }));
  assert.deepEqual([stacked.checklist_score, stacked.grade_letter], [90, 'C']);
  const diagonal = createTrade(input({ target_type: 'Trendline/diagonal' }));
  assert.equal(diagonal.grade_letter, 'B');
  const minor = createTrade(input({ sweep_tier: 'minor' }));
  assert.deepEqual([minor.checklist_score, minor.grade_letter], [92, 'A']);
});

test('the sweep tier and singular gap are stored as structured fields', () => {
  const t = createTrade(input({ sweep_tier: 'minor', singular_gap: false }));
  assert.equal(t.sweep_tier, 'minor');
  assert.equal(t.singular_gap, false);
  // Rubric 1's box follows the tier, so it is never left saying something else.
  assert.equal(t.chk_sweep, false);
  assert.equal(createTrade(input({ sweep_tier: 'major' })).chk_sweep, true);
});

test('while Planned the grade follows the answers; leaving Planned locks it for good', () => {
  const t = createTrade(input({ status: 'Planned', sweep_tier: 'none' }));
  assert.equal(t.grade_letter, 'C');
  // Still Planned: fixing the sweep re-grades it.
  const fixed = updateTrade(t.id, input({ status: 'Planned', sweep_tier: 'major' }))!;
  assert.deepEqual([fixed.grade_letter, fixed.grade_at_entry], ['A+', 100]);
  // The edit that leaves Planned is the last one that counts.
  const live = updateTrade(t.id, input({ status: 'Live', sweep_tier: 'minor', chk_clean_path: false }))!;
  assert.deepEqual([live.status, live.checklist_score, live.grade_letter, live.grade_at_entry], ['Live', 87, 'A', 87]);
  // After that, answers can change — the grade cannot.
  const later = updateTrade(t.id, input({ status: 'Settled', sweep_tier: 'none', singular_gap: false }))!;
  assert.deepEqual([later.checklist_score, later.grade_letter, later.grade_at_entry], [87, 'A', 87]);
  assert.equal(later.sweep_tier, 'none');
  assert.equal(later.live_letter, 'C');
  // …and the correction is on the record.
  const fields = tradeHistory(t.id).map((e) => e.field);
  assert.ok(fields.includes('sweep_tier') && fields.includes('singular_gap'));
  assert.ok(!fields.includes('grade_at_entry'));
});

test('settling a Planned trade freezes its grade at entry', () => {
  const t = createTrade(input({ status: 'Planned', singular_gap: false }));
  const s = settleTrade(t.id, { outcome: 'Loss', r_multiple: -1 })!;
  assert.deepEqual([s.status, s.grade_letter, s.grade_at_entry], ['Settled', 'C', 90]);
  // Settling again (already locked) is fine, and changes nothing.
  const again = settleTrade(t.id, { outcome: 'Win', r_multiple: 1 })!;
  assert.deepEqual([again.grade_letter, again.grade_at_entry], ['C', 90]);
});

test('a trade that has left Planned cannot go back to it', () => {
  const t = createTrade(input());
  const r = parseTradeInput(raw({ status: 'Planned' }), {
    previous: { explanation: t.explanation, lesson: t.lesson, status: t.status, letter: t.grade_letter, regrade: t.regrade },
  });
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /cannot go back to Planned/);
  // Bulk edits skip the stage on such trades but still apply the rest.
  assert.equal(bulkUpdate([t.id], { status: 'Planned', reason: 'FOMO' }), 1);
  const after = getTrade(t.id)!;
  assert.deepEqual([after.status, after.reason], ['Settled', 'FOMO']);
});

test('reviews can only be harsher', () => {
  // New trade graded C: a B re-grade is refused, C and F are fine.
  const refused = parseTradeInput(raw({ sweep_tier: 'none', regrade: 'B' }));
  assert.equal(refused.ok, false);
  assert.match((refused as { error: string }).error, /Reviews can only be harsher\. If a C setup won, it was still a C setup\./);
  assert.equal(parseTradeInput(raw({ sweep_tier: 'none', regrade: 'C' })).ok, true);
  assert.equal(parseTradeInput(raw({ sweep_tier: 'none', regrade: 'F' })).ok, true);

  // A locked trade is checked against its locked letter, not today's answers.
  const t = createTrade(input({ sweep_tier: 'none' }));
  const prev = { explanation: t.explanation, lesson: t.lesson, status: t.status, letter: t.grade_letter, regrade: null };
  assert.equal(parseTradeInput(raw({ sweep_tier: 'major', regrade: 'A' }), { previous: prev }).ok, false);
  assert.equal(parseTradeInput(raw({ sweep_tier: 'major', regrade: 'C' }), { previous: prev }).ok, true);
  // A re-grade already on record from before the rule is kept, unchanged.
  assert.equal(parseTradeInput(raw({ regrade: 'A+' }), { previous: { ...prev, regrade: 'A+' as const } }).ok, true);
});

test('Other is retired: refused unless a trade already holds it, and renamed targets map across', () => {
  assert.equal(parseTradeInput(raw({ target_type: 'Bogus' })).ok, false);
  // Still valid for the trades filed under it.
  assert.equal(parseTradeInput(raw({ target_type: 'Other' })).ok, true);
  assert.equal(input({ target_type: 'Diagonal trendline' }).target_type, 'Trendline/diagonal');
  assert.equal(input({ target_type: 'Data wick' }).target_type, 'Data wick (ITH/ITL)');
});

test('restoring an export from before rubric 2 reads the old answers like migration 015', () => {
  const r = parseTradeInput(raw({ sweep_tier: undefined, chk_sweep: true, singular_gap: false, rubric_version: 1 }), { restoring: true });
  assert.ok(r.ok);
  assert.deepEqual([r.value.sweep_tier, r.value.singular_gap, r.value.chk_sweep], ['major', null, true]);
});

test('the JSON and CSV exports carry sweep_tier and singular_gap', async () => {
  const made = createTrade(input({ sweep_tier: 'minor', singular_gap: false }));
  const zip = Buffer.from(await (await exportRoute.GET()).arrayBuffer());
  const json = JSON.parse(unzip(zip, 'trades.json').toString('utf8')) as { trades: Array<Record<string, unknown>> };
  const row = json.trades.find((t) => t.id === made.id)!;
  assert.equal(row.sweep_tier, 'minor');
  assert.equal(row.singular_gap, false);
  const [head, ...lines] = unzip(zip, 'trades.csv').toString('utf8').split('\n');
  const cols = head.split(',');
  const line = lines.find((l) => l.startsWith(made.id))!.split(',');
  assert.equal(line[cols.indexOf('sweep_tier')], 'minor');
  assert.equal(line[cols.indexOf('singular_gap')], 'false');
  assert.equal(line[cols.indexOf('rubric_version')], '3');
});

test('the model breakdowns count, win-rate and total R by each gate', () => {
  const all = listTrades();
  const m = modelBreakdowns(all, all);
  const row = (rows: typeof m.sweepTier, key: string) => rows.find((r) => r.key === key)!;
  const minor = all.filter((t) => t.sweep_tier === 'minor' && t.outcome !== 'Not taken');
  assert.equal(row(m.sweepTier, 'minor').stats.taken, minor.length);
  assert.equal(row(m.sweepTier, 'minor').stats.totalR, minor.reduce((s, t) => s + (t.r_multiple ?? 0), 0));
  assert.deepEqual(m.sweepTier.slice(0, 3).map((r) => r.key), ['major', 'minor', 'none']);
  assert.deepEqual(m.singularGap.slice(0, 2).map((r) => r.key), ['yes', 'no']);
  assert.deepEqual(m.entryGrade.map((r) => r.key), ['A+', 'A', 'B', 'C', 'F']);
  assert.ok(row(m.targetType, 'Trendline/diagonal').stats.count >= 1);
  assert.ok(row(m.account, 'Live').stats.count === all.filter((t) => t.account === 'Live').length);
  const wins = all.filter((t) => t.grade_letter === 'C' && t.outcome === 'Win').length;
  const losses = all.filter((t) => t.grade_letter === 'C' && t.outcome === 'Loss').length;
  assert.equal(row(m.entryGrade, 'C').stats.winRate, wins / (wins + losses));
});

test('a trade that failed a gate broke the rules, whatever its score', () => {
  const gated = createTrade(input({ sweep_tier: 'minor', singular_gap: false }));
  assert.equal(gated.checklist_score, 82);
  assert.equal(adherenceOf(gated), 'broken');
  assert.equal(adherenceOf(createTrade(input({ sweep_tier: 'minor' }))), 'followed');
  // The diagonal cap is not a gate: a B trade is still the model.
  assert.equal(adherenceOf(createTrade(input({ target_type: 'Trendline/diagonal' }))), 'followed');
  // A rubric 1 trade was never held to the gates.
  assert.equal(adherenceOf({ ...gated, rubric_version: 1 }), 'followed');
});

test('a delete keeps its reason; a restore clears it; the history keeps both', () => {
  const t = createTrade(input());
  softDeleteTrade(t.id, 'Logged it twice: entered from the phone as well');
  const gone = getTrade(t.id)!;
  assert.ok(gone.deleted_at);
  assert.equal(gone.deleted_reason, 'Logged it twice: entered from the phone as well');
  restoreTrade(t.id);
  const back = getTrade(t.id)!;
  assert.deepEqual([back.deleted_at, back.deleted_reason], [null, null]);
  const h = tradeHistory(t.id).map((e) => [e.field, e.old_value, e.new_value]);
  assert.deepEqual(h.find((e) => e[0] === 'deleted'), ['deleted', null, 'Logged it twice: entered from the phone as well']);
  assert.deepEqual(h.find((e) => e[0] === 'restored'), ['restored', 'Logged it twice: entered from the phone as well', null]);
});
