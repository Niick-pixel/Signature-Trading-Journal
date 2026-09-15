import type { Account } from './domain';
import { isTaken } from './domain';
import type { CashEvent, Trade } from './types';

/**
 * Where the account is, and how much of that the journal actually knows.
 *
 * Derived rather than stored: a stored balance and a list of trades are two
 * things claiming to be the truth, and they diverge the moment either is
 * edited. This works the way the account works — money in, money out, and
 * whatever the trades paid.
 */
export interface Balance {
  /** Null when there is nothing at all to compute from. */
  current: number | null;
  deposited: number;
  withdrawn: number;
  /** Realised P&L counted toward `current` — only trades after the anchor. */
  realised: number;
  /** The most recent reconcile, if any. Everything before it is ignored. */
  anchor: CashEvent | null;
  /**
   * Taken trades counted in the window that carry no dollar figure.
   *
   * This is the honesty valve. Trades logged before the P&L payload bug was
   * fixed have no money on them, so a balance derived over them is confidently
   * wrong. When this is above zero the figure is incomplete and the UI has to
   * say so rather than presenting it as the account's true position.
   */
  unpriced: number;
}

/** Realised P&L of one trade, or null when none was recorded. */
function realisedOf(t: Trade): number | null {
  return isTaken(t.outcome) ? t.pnl_dollars : null;
}

export function balanceFor(
  trades: Trade[],
  events: CashEvent[],
  account: Account | 'All',
): Balance {
  /*
    There is no such thing as a combined balance.

    Every other figure in this app refuses to pool accounts, because replay
    fills are not real fills and a demo account has no fear in it. A balance is
    the strongest version of that rule: adding backtest dollars to live dollars
    produces a number no broker would recognise and that no decision should
    ever be made on. So 'All' has no balance, and says so.
  */
  if (account === 'All') {
    return { current: null, deposited: 0, withdrawn: 0, realised: 0, anchor: null, unpriced: 0 };
  }

  const mine = events.filter((e) => e.account === account);
  const myTrades = trades.filter((t) => t.account === account);

  /*
    The latest reconcile wins, and its own date is the floor. Anything dated
    before the broker's own statement is already inside that statement —
    counting it again would double it.
  */
  const anchor = mine
    .filter((e) => e.kind === 'reconcile')
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1) ?? null;
  const after = (date: string) => (anchor ? date > anchor.date : true);

  let deposited = 0;
  let withdrawn = 0;
  for (const e of mine) {
    if (!after(e.date)) continue;
    if (e.kind === 'deposit') deposited += e.amount;
    if (e.kind === 'withdrawal') withdrawn += e.amount;
  }

  let realised = 0;
  let unpriced = 0;
  for (const t of myTrades) {
    if (t.deleted_at) continue;
    if (!isTaken(t.outcome)) continue;
    if (!after(t.date)) continue;
    const pnl = realisedOf(t);
    if (pnl == null) unpriced += 1;
    else realised += pnl;
  }

  const hasSomething = anchor !== null || mine.length > 0 || realised !== 0;
  const current = hasSomething
    ? (anchor?.amount ?? 0) + deposited - withdrawn + realised
    : null;

  return { current, deposited, withdrawn, realised, anchor, unpriced };
}
