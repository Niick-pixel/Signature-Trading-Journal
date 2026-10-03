/**
 * A trade's date as text — or "Undated" for a backtest logged without one.
 *
 * An undated backtest still has a `date`: the moment it was logged (see
 * migration 019). Printing it would claim the trade happened that day, so
 * everything that shows a trade's date goes through here.
 */
export const UNDATED = 'Undated';

type Dated = { date: string; undated?: boolean | null };

export function tradeDay(t: Dated, opts?: Intl.DateTimeFormatOptions): string {
  return t.undated ? UNDATED : new Date(t.date).toLocaleDateString(undefined, opts);
}

export function tradeTime(t: Dated, opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }): string {
  return t.undated ? '' : new Date(t.date).toLocaleTimeString(undefined, opts);
}

export function tradeWhen(t: Dated, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }): string {
  return t.undated ? UNDATED : new Date(t.date).toLocaleString(undefined, opts);
}
