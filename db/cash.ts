import 'server-only';
import crypto from 'node:crypto';
import { getDb } from './index';
import { ACCOUNTS, type Account } from '../lib/domain';
import { CASH_KINDS, type CashEvent, type CashKind } from '../lib/types';

/**
 * Into a plain object, field by field.
 *
 * node:sqlite hands back rows with a null prototype, and React refuses to pass
 * one from a server component to a client one — the balance card took the whole
 * page down with it. Naming the fields also means a column added later cannot
 * leak across the boundary by accident.
 */
function hydrate(row: Record<string, unknown>): CashEvent {
  return {
    id: String(row.id),
    account: row.account as CashEvent['account'],
    kind: row.kind as CashEvent['kind'],
    amount: Number(row.amount),
    date: String(row.date),
    note: row.note == null ? null : String(row.note),
    created_at: String(row.created_at),
  };
}

export function listCashEvents(): CashEvent[] {
  return (getDb()
    .prepare('SELECT * FROM cash_events ORDER BY date DESC, created_at DESC')
    .all() as Record<string, unknown>[]).map(hydrate);
}

export interface CashInput {
  account: Account;
  kind: CashKind;
  amount: number;
  date: string;
  note: string | null;
}

/**
 * Validates here rather than trusting the caller, for the same reason the
 * trade payload is validated: the CHECK constraints are the real backstop, and
 * this exists so the UI gets a sentence instead of a constraint name.
 */
export function parseCashInput(raw: unknown): { ok: true; value: CashInput } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'Malformed payload.' };
  const t = raw as Record<string, unknown>;

  const account = typeof t.account === 'string' && (ACCOUNTS as readonly string[]).includes(t.account)
    ? (t.account as Account) : null;
  if (!account) return { ok: false, error: 'Pick which account this is for.' };

  const kind = typeof t.kind === 'string' && (CASH_KINDS as readonly string[]).includes(t.kind)
    ? (t.kind as CashKind) : null;
  if (!kind) return { ok: false, error: 'Deposit, withdrawal or balance check?' };

  const amount = Number(t.amount);
  if (!Number.isFinite(amount)) return { ok: false, error: 'That is not an amount.' };
  // A magnitude. The direction is the kind, and a signed amount here would
  // silently invert a withdrawal into a deposit.
  if (amount < 0) return { ok: false, error: 'Enter the amount as a positive number — the kind says which way it went.' };

  const date = typeof t.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(t.date) ? t.date : null;
  if (!date) return { ok: false, error: 'A date is required.' };

  const note = typeof t.note === 'string' && t.note.trim() ? t.note.trim() : null;
  return { ok: true, value: { account, kind, amount, date, note } };
}

export function createCashEvent(input: CashInput): CashEvent {
  const id = crypto.randomUUID();
  getDb()
    .prepare(`INSERT INTO cash_events (id, account, kind, amount, date, note)
              VALUES (@id, @account, @kind, @amount, @date, @note)`)
    .run({ id, ...input });
  return hydrate(getDb().prepare('SELECT * FROM cash_events WHERE id = ?').get(id) as Record<string, unknown>);
}

/**
 * Restore under the id the export carried.
 *
 * createCashEvent mints a fresh id, which is right for a new entry and wrong
 * for a restore: the id is what makes importing the same backup twice a no-op
 * the second time, and a new one every time would double the money history on
 * every import. Same rule the trades importer follows.
 */
export function importCashEvent(id: string, input: CashInput): void {
  getDb()
    .prepare(`INSERT INTO cash_events (id, account, kind, amount, date, note)
              VALUES (@id, @account, @kind, @amount, @date, @note)`)
    .run({ id, ...input });
}

/** Hard delete: a cash event has no history worth keeping and no screenshot. */
export function deleteCashEvent(id: string): boolean {
  return getDb().prepare('DELETE FROM cash_events WHERE id = ?').run(id).changes > 0;
}
