import { NextResponse } from 'next/server';
import { getTrade, importTrade } from '@/db/trades';
import { importCashEvent, listCashEvents, parseCashInput } from '@/db/cash';
import { parseTradeInput } from '@/lib/validate';

/**
 * Restores trades from an export.
 *
 * Idempotent on id: importing the same file twice changes nothing the second
 * time. That matters because the obvious thing to do with a backup is import
 * it again to check it worked, and that must not double every trade.
 *
 * Screenshots are matched by the path already stored on the row. A trade whose
 * image is missing still imports — a record without its chart is worth more
 * than no record.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as
    { trades?: unknown; cash?: unknown; format?: unknown } | null;

  if (!body || !Array.isArray(body.trades)) {
    return NextResponse.json(
      { error: 'Not a Signature export — expected a { trades: [...] } object.' },
      { status: 400 },
    );
  }

  let imported = 0;
  let skipped = 0;
  const rejected: Array<{ id: string; error: string }> = [];

  for (const raw of body.trades) {
    const id = (raw as { id?: unknown })?.id;
    if (typeof id !== 'string') {
      rejected.push({ id: '(no id)', error: 'Missing id.' });
      continue;
    }
    if (getTrade(id)) { skipped += 1; continue; }

    // Restoring, not authoring: these rows cleared whatever floor was in force
    // when they were written, and a backup that will not restore is not one.
    const check = parseTradeInput(raw, { restoring: true });
    if (!check.ok) { rejected.push({ id, error: check.error }); continue; }

    const r = raw as Record<string, unknown>;
    importTrade(id, check.value, {
      position_x: typeof r.position_x === 'number' ? r.position_x : null,
      position_y: typeof r.position_y === 'number' ? r.position_y : null,
      deleted_at: typeof r.deleted_at === 'string' ? r.deleted_at : null,
      created_at: typeof r.created_at === 'string' ? r.created_at : null,
    });
    imported += 1;
  }

  /*
    Money movements, matched on id the same way trades are.

    A version-1 export has no `cash` key, which is not an error — it is a file
    written before the journal knew about money, and it restores exactly as
    well as it ever did.
  */
  let cash = 0;
  let cashSkipped = 0;
  if (Array.isArray(body.cash)) {
    const existing = new Set(listCashEvents().map((e) => e.id));
    for (const raw of body.cash) {
      const id = (raw as { id?: unknown })?.id;
      if (typeof id !== 'string' || existing.has(id)) { cashSkipped += 1; continue; }
      const check = parseCashInput(raw);
      if (!check.ok) { rejected.push({ id, error: check.error }); continue; }
      importCashEvent(id, check.value);
      cash += 1;
    }
  }

  return NextResponse.json({ imported, skipped, rejected, cash, cashSkipped });
}
