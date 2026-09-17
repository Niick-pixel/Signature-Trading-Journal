import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { listTrades } from '@/db/trades';
import { listCashEvents } from '@/db/cash';
import { listJournalPages } from '@/db/journal';
import { SCREENSHOTS_DIR } from '@/lib/paths';
import { makeZip } from '@/lib/zip';
import type { JournalPage, Trade } from '@/lib/types';

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

/** Every page, in date order, as one document that stands on its own. */
function journalDocument(pages: JournalPage[], now: Date): string {
  const ordered = [...pages].sort((a, b) => a.day.localeCompare(b.day));
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = ordered.map((p) => `
  <article>
    <h2>${esc(p.title || 'Untitled')}</h2>
    <p class="day">${esc(p.day)}</p>
    ${p.body || '<p><em>Empty page.</em></p>'}
  </article>`).join('\n');

  return `<!doctype html>
<meta charset="utf-8">
<title>Signature — journal</title>
<style>
  body { max-width: 42rem; margin: 3rem auto; padding: 0 1.25rem;
         font: 17px/1.7 -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
         color: #241b12; background: #f6f1e6; }
  h1 { font-size: 1.6rem; letter-spacing: -0.01em; }
  article { margin: 3.5rem 0; }
  article + article { border-top: 1px solid #d9cfba; padding-top: 3rem; }
  h2 { font-size: 1.3rem; margin-bottom: 0.2rem; }
  .day { margin: 0 0 1.5rem; color: #8a7a63; font-size: 0.8rem; }
  blockquote { margin: 1.2em 0; padding-left: 1em; border-left: 2px solid #b8860b; font-style: italic; }
  img { max-width: 100%; border-radius: 10px; }
  @media print { body { background: #fff; } article { page-break-inside: avoid; } }
</style>
<h1>Journal</h1>
<p class="day">${ordered.length} page${ordered.length === 1 ? '' : 's'} · exported ${now.toISOString().slice(0, 10)}</p>
${body}
`;
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
  const journal = listJournalPages();
  const now = new Date();

  const payload = {
    format: 'signature-journal',
    // Bumped as the payload grew: 2 added cash, 3 added the journal. An older
    // file simply has no key for the newer things, which the importer reads as
    // "none" rather than as an error.
    version: 3,
    exported_at: now.toISOString(),
    count: trades.length,
    trades,
    cash,
    journal,
  };

  const zip = makeZip([
    { name: 'trades.json', data: Buffer.from(JSON.stringify(payload, null, 2), 'utf8') },
    { name: 'trades.csv', data: Buffer.from(toCsv(trades), 'utf8') },
    /*
      The journal twice over: once as data that can be restored, and once as
      one readable document in date order. The second one is the point of
      writing any of it — a backup you can only restore into this app is not
      something you can sit and read.
    */
    { name: 'journal.html', data: Buffer.from(journalDocument(journal, now), 'utf8') },
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
