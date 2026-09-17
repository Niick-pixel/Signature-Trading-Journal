import { listJournalPages } from '@/db/journal';
import { listTrades } from '@/db/trades';
import { TitleBar } from '@/components/shell/TitleBar';
import { JournalBook } from '@/components/journal/JournalBook';
import type { DayTradeSummary } from '@/components/journal/DayStrip';

export const dynamic = 'force-dynamic';

/**
 * The journal proper — writing with no trade attached to it.
 *
 * Wider than the review screens and narrower than the board: a page of prose
 * wants a readable measure, and the spine beside it wants to show enough of
 * each entry to be recognised.
 */
export default async function JournalRoute() {
  const pages = listJournalPages();

  /*
    The day's trades, per day, slimmed to what the strip draws.

    Passing whole Trade rows would ship every explanation and lesson in the
    database to the client to render a row of chips — a hundred trades is a
    hundred pairs of 160-character essays crossing the boundary for nothing.
  */
  const byDay: Record<string, DayTradeSummary[]> = {};
  for (const t of listTrades()) {
    const day = t.date.slice(0, 10);
    (byDay[day] ??= []).push({
      id: t.id,
      time: new Date(t.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
      reason: t.reason,
      instrument: t.instrument,
      direction: t.direction,
      setup_type: t.setup_type,
      outcome: t.outcome,
      r_multiple: t.r_multiple,
      pnl_dollars: t.pnl_dollars,
      grade_letter: t.grade_letter,
      mistake_tags: t.mistake_tags,
    });
  }
  for (const list of Object.values(byDay)) list.sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="flex h-dvh flex-col">
      <TitleBar />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[82rem] px-6 pb-16 pt-4">
          <header className="mb-5">
            <h1 className="text-[22px] font-semibold tracking-tight">Journal</h1>
            <p className="mt-1 text-[13px]" style={{ color: 'var(--text-dim)' }}>
              Not about one trade. Ideas, a summary of a week, something noticed on a Tuesday.
              Nothing here is required and nothing is scored.
            </p>
          </header>

          <JournalBook initial={pages} tradesByDay={byDay} />
        </div>
      </div>
    </div>
  );
}
