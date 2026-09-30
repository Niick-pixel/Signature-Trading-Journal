/*
  export → wipe → import, through the real routes: every row comes back
  identical, and importing the same file twice changes nothing.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'signature-rt-'));
process.env.SIGNATURE_DATA_DIR = DIR;
process.env.SIGNATURE_MIGRATIONS_DIR = path.resolve('db/migrations');

const { getDb } = await import('../db/index');
const { createTrade, softDeleteTrade, dismissFlag } = await import('../db/trades');
const { createCashEvent } = await import('../db/cash');
const { saveDailyReview, saveWeeklyReview } = await import('../db/reviews');
const { createJournalPage } = await import('../db/journal');
const { savePrep } = await import('../db/prep');
const { parsePrepData } = await import('../lib/prep');
const { parseTradeInput } = await import('../lib/validate');
const exportRoute = await import('../app/api/export/route');
const importRoute = await import('../app/api/import/route');

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

const payload = (t: Record<string, unknown>) => {
  const r = parseTradeInput({
    date: '2026-09-20T09:41', instrument: 'NQ', direction: 'Long', session: 'NY AM', reason: 'Rules-based (A+ setup)',
    setup_type: 'iFVG', htf_bias: 'With bias', premium_discount: 'Discount', target_type: 'Opposing FVG',
    outcome: 'Win', r_multiple: 2.1, account: 'Live', explanation: 'E'.repeat(170), lesson: 'L'.repeat(170),
    screenshot_path: 'x.png', chk_returned_to_fvg: true, chk_inversion_close: true, ...t,
  });
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

/** Every row of every table that export/import carries, minus what a restore legitimately rewrites. */
function fingerprint() {
  const db = getDb();
  const rows = (sql: string) => db.prepare(sql).all().map((r) => {
    const { updated_at: _u, ...rest } = r as Record<string, unknown>;
    return rest;
  });
  const snap = {
    trades: rows('SELECT * FROM trades ORDER BY id'),
    cash: rows('SELECT * FROM cash_events ORDER BY id'),
    daily: rows('SELECT * FROM daily_reviews ORDER BY day'),
    weekly: rows('SELECT week_start, summary, reviewed_ids FROM weekly_reviews ORDER BY week_start'),
    pages: rows('SELECT id, day, title, body, pinned, created_at FROM journal_pages ORDER BY id'),
    prep: rows('SELECT day, data, started_at, completed_at FROM session_prep ORDER BY day'),
  };
  return {
    counts: Object.fromEntries(Object.entries(snap).map(([k, v]) => [k, v.length])),
    sum: crypto.createHash('sha256').update(JSON.stringify(snap)).digest('hex'),
    snap,
  };
}

/** Which table, row and field differ — so a failure says what, not just that. */
function differences(a: ReturnType<typeof fingerprint>['snap'], b: ReturnType<typeof fingerprint>['snap']): string[] {
  const out: string[] = [];
  for (const table of Object.keys(a) as Array<keyof typeof a>) {
    a[table].forEach((row, i) => {
      for (const [k, v] of Object.entries(row)) {
        const w = (b[table][i] as Record<string, unknown>)?.[k];
        if (JSON.stringify(v) !== JSON.stringify(w)) out.push(`${table}[${i}].${k}: ${JSON.stringify(v)} → ${JSON.stringify(w)}`);
      }
    });
  }
  return out;
}

test('export → wipe → import restores every row exactly', async () => {
  getDb();
  const a = createTrade(payload({}));
  createTrade(payload({ outcome: 'Loss', r_multiple: -1, account: 'Demo', chk_sweep: null, chk_killzone: false,
    mistake_tags: ['Entered late', 'Chased'], worked_tags: ['Sized correctly'], followed_rules: true }));
  createTrade(payload({ quick_log: true, explanation: 'Chased again', lesson: '', screenshot_path: '' }));
  const gone = createTrade(payload({ outcome: 'Not taken', r_multiple: null, skip_reason: 'Fear' }));
  softDeleteTrade(gone.id);
  dismissFlag(a.id, 'settled_without_risk', 'Paper trade');
  createCashEvent({ account: 'Live', kind: 'deposit', amount: 500, date: '2026-09-01', note: 'Funding' });
  saveDailyReview('2026-09-20', { sleep_hours: 7, state_of_mind: 4, bias: 'Up', bias_direction: 'Bullish', news: 'High', news_note: 'CPI 8:30' }, { checkIn: true });
  saveWeeklyReview('2026-09-14', 'Held the line.', [a.id]);
  createJournalPage({ day: '2026-09-20', title: 'Notes', body: '<p>Patience.</p>', pinned: false });
  savePrep('2026-09-20', parsePrepData({
    steps: { htf: 'done', eqhl: 'done' }, levels: [{ id: 'l1', step: 'eqhl', kind: 'EQH', price: 30906 }],
    draw: { direction: 'Up', target: 30906 },
  }), true);
  const before = fingerprint();
  assert.deepEqual(before.counts, { trades: 4, cash: 1, daily: 1, weekly: 1, pages: 1, prep: 1 });

  const zip = Buffer.from(await (await exportRoute.GET()).arrayBuffer());
  const json = unzip(zip, 'trades.json').toString('utf8');

  // Wipe: close the journal and delete it.
  (globalThis as { __signatureDb?: { close(): void } }).__signatureDb?.close();
  delete (globalThis as { __signatureDb?: unknown }).__signatureDb;
  for (const f of ['journal.db', 'journal.db-wal', 'journal.db-shm']) fs.rmSync(path.join(DIR, f), { force: true });
  assert.deepEqual(fingerprint().counts, { trades: 0, cash: 0, daily: 0, weekly: 0, pages: 0, prep: 0 });

  const res = await importRoute.POST(new Request('http://local/api/import', { method: 'POST', body: json }));
  assert.equal(res.status, 200);
  const result = await res.json();
  assert.equal(result.imported, 4, JSON.stringify(result.rejected));

  const after = fingerprint();
  assert.deepEqual(after.counts, before.counts);
  assert.deepEqual(differences(before.snap, after.snap), []);
  assert.equal(after.sum, before.sum);

  // The same file again: nothing changes.
  const again = await (await importRoute.POST(new Request('http://local/api/import', { method: 'POST', body: json }))).json();
  assert.equal(again.imported, 0);
  assert.equal(again.skipped, 4);
  assert.equal(fingerprint().sum, before.sum);
});
