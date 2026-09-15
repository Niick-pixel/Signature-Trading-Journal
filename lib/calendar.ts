import { isTaken } from './domain';
import type { Trade } from './types';

/**
 * One square on the calendar.
 *
 * Money and R are kept apart on purpose. R is what the plan did; dollars are
 * what the account did, and they only agree when every trade that day carries a
 * recorded P&L. `unpriced` says how many did not, so a day can show its R
 * honestly while admitting it cannot show its money.
 */
export interface DayCell {
  /** YYYY-MM-DD. */
  day: string;
  /** Null when no trade that day has a dollar figure. */
  pnl: number | null;
  totalR: number;
  taken: number;
  wins: number;
  losses: number;
  /** Trades taken that day with no P&L recorded. */
  unpriced: number;
  /** Rule breaks that day, by the checklist rather than by self-report. */
  broken: number;
}

export interface MonthSummary {
  net: number | null;
  totalR: number;
  taken: number;
  greenDays: number;
  redDays: number;
  tradedDays: number;
  best: DayCell | null;
  worst: DayCell | null;
  /** Largest single-day loss in dollars, as a positive number. */
  worstDayLoss: number | null;
  unpriced: number;
}

/** Local-date key for a stored trade timestamp. */
export function dayKey(date: string): string {
  return date.slice(0, 10);
}

export function cellsByDay(trades: Trade[], brokenIds: ReadonlySet<string>): Map<string, DayCell> {
  const map = new Map<string, DayCell>();
  for (const t of trades) {
    if (t.deleted_at) continue;
    if (!isTaken(t.outcome)) continue;
    const day = dayKey(t.date);
    const cell = map.get(day) ?? {
      day, pnl: null, totalR: 0, taken: 0, wins: 0, losses: 0, unpriced: 0, broken: 0,
    };
    cell.taken += 1;
    if (t.outcome === 'Win') cell.wins += 1;
    if (t.outcome === 'Loss') cell.losses += 1;
    if (t.r_multiple != null) cell.totalR += t.r_multiple;
    if (t.pnl_dollars == null) cell.unpriced += 1;
    else cell.pnl = (cell.pnl ?? 0) + t.pnl_dollars;
    if (brokenIds.has(t.id)) cell.broken += 1;
    map.set(day, cell);
  }
  return map;
}

/** The days of a month, Monday-first, padded to whole weeks. */
export function monthGrid(year: number, month: number): Array<string | null> {
  const first = new Date(Date.UTC(year, month, 1));
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // getUTCDay is Sunday-0; the week starts on Monday here.
  const lead = (first.getUTCDay() + 6) % 7;

  const cells: Array<string | null> = Array(lead).fill(null);
  for (let d = 1; d <= days; d += 1) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function summarise(cells: DayCell[]): MonthSummary {
  let net: number | null = null;
  let totalR = 0;
  let taken = 0;
  let greenDays = 0;
  let redDays = 0;
  let unpriced = 0;
  let best: DayCell | null = null;
  let worst: DayCell | null = null;

  for (const c of cells) {
    taken += c.taken;
    totalR += c.totalR;
    unpriced += c.unpriced;
    if (c.pnl != null) {
      net = (net ?? 0) + c.pnl;
      if (c.pnl > 0) greenDays += 1;
      if (c.pnl < 0) redDays += 1;
      if (best == null || c.pnl > (best.pnl as number)) best = c;
      if (worst == null || c.pnl < (worst.pnl as number)) worst = c;
    } else {
      // No money on the day, so fall back to R for the colour count.
      if (c.totalR > 0) greenDays += 1;
      if (c.totalR < 0) redDays += 1;
    }
  }

  return {
    net, totalR, taken, greenDays, redDays,
    tradedDays: cells.length,
    best, worst,
    worstDayLoss: worst && worst.pnl != null && worst.pnl < 0 ? -worst.pnl : null,
    unpriced,
  };
}
