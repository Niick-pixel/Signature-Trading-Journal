import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { listTrades } from '@/db/trades';
import { listCashEvents } from '@/db/cash';
import { SCREENSHOTS_DIR } from '@/lib/paths';
import { makeZip } from '@/lib/zip';
import type { Trade } from '@/lib/types';

/** Columns in a stable, readable order. Same order every export, so diffs work. */
const CSV_COLUMNS: Array<keyof Trade> = [
  'id', 'date', 'account', 'account_label', 'status', 'instrument', 'direction', 'session',
  'reason', 'setup_type', 'htf_bias', 'premium_discount', 'target_type',
  'checklist_score', 'grade_letter', 'trigger_fired', 'grade_at_entry', 'graded_post_hoc',
  'followed_rules', 'regrade', 'mistake_tags',
  'outcome', 'r_multiple', 'contracts', 'risk_dollars', 'risk_percent', 'stop_points',
  'entry_price', 'take_profit', 'stop_loss',
  'would_have_hit_tp', 'r_left_on_table', 'skip_reason',
  'explanation', 'lesson', 'screenshot_path', 'deleted_at', 'created_at', 'updated_at',
];

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = Array.isArray(v) ? v.join('; ') : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(trades: Trade[]): string {
  const head = CSV_COLUMNS.join(',');
  const rows = trades.map((t) => CSV_COLUMNS.map((c) => csvCell(t[c])).join(','));
  return [head, ...rows].join('\n');
}

/** Every screenshot referenced by a trade, by its stored relative path. */
function screenshotEntries(trades: Trade[]): Array<{ name: string; data: Buffer }> {
  const out: Array<{ name: string; data: Buffer }> = [];
  const seen = new Set<string>();
  for (const t of trades) {
    if (seen.has(t.screenshot_path)) continue;
    seen.add(t.screenshot_path);
    const abs = path.join(SCREENSHOTS_DIR, t.screenshot_path);
    // A missing file must not fail the whole export — the point of an export is
    // to get everything that still exists out.
    if (!abs.startsWith(SCREENSHOTS_DIR) || !fs.existsSync(abs)) continue;
    out.push({ name: `screenshots/${t.screenshot_path}`, data: fs.readFileSync(abs) });
  }
  return out;
}

/**
 * Everything, in one file: the trades as JSON, the same trades as CSV for a
 * spreadsheet, every screenshot, and the money movements. Soft-deleted rows are
 * included — an export that quietly drops the trades I binned is not a backup,
 * and neither is one that restores the trades but forgets where the account was.
 */
export async function GET() {
  const trades = listTrades({ bin: 'all' });
  const cash = listCashEvents();
  const now = new Date();

  const payload = {
    format: 'signature-journal',
    // Bumped when cash_events joined the payload. An older file has no `cash`
    // key at all, which the importer reads as "none" rather than as an error.
    version: 2,
    exported_at: now.toISOString(),
    count: trades.length,
    trades,
    cash,
  };

  const zip = makeZip([
    { name: 'trades.json', data: Buffer.from(JSON.stringify(payload, null, 2), 'utf8') },
    { name: 'trades.csv', data: Buffer.from(toCsv(trades), 'utf8') },
    ...screenshotEntries(trades),
  ], now);

  const stamp = now.toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="signature-${stamp}.zip"`,
      'Content-Length': String(zip.length),
    },
  });
}
