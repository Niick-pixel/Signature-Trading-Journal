import { NextResponse } from 'next/server';
import { getTrade, importTrade } from '@/db/trades';
import { importCashEvent, listCashEvents, parseCashInput } from '@/db/cash';
import { getJournalPage, importJournalPage, parseJournalInput } from '@/db/journal';
import { getDailyReview, getWeeklyReview, restoreCheckIn, saveDailyReview, saveWeeklyReview } from '@/db/reviews';
import { BIAS_DIRECTIONS, NEWS_LEVELS } from '@/lib/domain';
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
    {
      trades?: unknown; cash?: unknown; journal?: unknown; format?: unknown;
      daily_reviews?: unknown; weekly_reviews?: unknown;
    } | null;

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

  /*
    Journal pages, matched on id like everything else. A version-1 or -2 export
    has no `journal` key, which is a file written before the journal existed
    and restores exactly as well as it ever did.
  */
  let journal = 0;
  let journalSkipped = 0;
  if (Array.isArray(body.journal)) {
    for (const raw of body.journal) {
      const id = (raw as { id?: unknown })?.id;
      if (typeof id !== 'string' || getJournalPage(id)) { journalSkipped += 1; continue; }
      const check = parseJournalInput(raw);
      if (!check.ok) { rejected.push({ id, error: check.error }); continue; }
      const created = (raw as { created_at?: unknown }).created_at;
      importJournalPage(id, check.value, typeof created === 'string' ? created : null);
      journal += 1;
    }
  }

  /*
    Reviews, matched on the day (or the week) they are about. Like everything
    else here an import never overwrites: a morning already written on this
    machine is kept as it is. Files older than version 4 carry no reviews,
    which reads as none rather than as an error.
  */
  const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const strOrNull = (v: unknown) => (typeof v === 'string' ? v : null);

  let reviews = 0;
  let reviewsSkipped = 0;
  if (Array.isArray(body.daily_reviews)) {
    for (const raw of body.daily_reviews as Record<string, unknown>[]) {
      if (!raw || !isDay(raw.day) || getDailyReview(raw.day)) { reviewsSkipped += 1; continue; }
      const mind = numOrNull(raw.state_of_mind);
      saveDailyReview(raw.day, {
        account: strOrNull(raw.account),
        bias: strOrNull(raw.bias),
        bias_screenshot: strOrNull(raw.bias_screenshot),
        planned_killzones: strOrNull(raw.planned_killzones),
        planned_levels: strOrNull(raw.planned_levels),
        what_happened: strOrNull(raw.what_happened),
        bias_held: raw.bias_held == null ? null : Boolean(raw.bias_held),
        trades_planned: numOrNull(raw.trades_planned),
        screen_minutes: numOrNull(raw.screen_minutes),
        sleep_hours: numOrNull(raw.sleep_hours),
        // The column only takes 1–5; a bad value is dropped, not the morning.
        state_of_mind: mind != null && mind >= 1 && mind <= 5 ? Math.round(mind) : null,
        notes: strOrNull(raw.notes),
        bias_direction: BIAS_DIRECTIONS.find((d) => d === raw.bias_direction) ?? null,
        news: NEWS_LEVELS.find((n) => n === raw.news) ?? null,
        news_note: strOrNull(raw.news_note),
      });
      // When the morning was written is part of what the morning says.
      if (typeof raw.checked_in_at === 'string') restoreCheckIn(raw.day, raw.checked_in_at);
      reviews += 1;
    }
  }
  if (Array.isArray(body.weekly_reviews)) {
    for (const raw of body.weekly_reviews as Record<string, unknown>[]) {
      if (!raw || !isDay(raw.week_start) || getWeeklyReview(raw.week_start)) { reviewsSkipped += 1; continue; }
      const ids = Array.isArray(raw.reviewed_ids) ? raw.reviewed_ids.filter((x): x is string => typeof x === 'string') : [];
      saveWeeklyReview(raw.week_start, strOrNull(raw.summary) ?? '', ids);
      reviews += 1;
    }
  }

  return NextResponse.json({
    imported, skipped, rejected, cash, cashSkipped, journal, journalSkipped, reviews, reviewsSkipped,
  });
}
