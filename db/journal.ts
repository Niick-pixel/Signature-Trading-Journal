import 'server-only';
import crypto from 'node:crypto';
import { getDb } from './index';
import { sanitiseHtml, toPlainText } from '../lib/sanitise';
import type { JournalPage } from '../lib/types';

function hydrate(row: Record<string, unknown>): JournalPage {
  return {
    id: String(row.id),
    day: String(row.day),
    title: String(row.title ?? ''),
    body: String(row.body ?? ''),
    plain: String(row.plain ?? ''),
    pinned: Boolean(row.pinned),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function listJournalPages(): JournalPage[] {
  return (getDb()
    .prepare('SELECT * FROM journal_pages ORDER BY pinned DESC, day DESC, created_at DESC')
    .all() as Record<string, unknown>[]).map(hydrate);
}

export function getJournalPage(id: string): JournalPage | null {
  const row = getDb().prepare('SELECT * FROM journal_pages WHERE id = ?').get(id) as
    Record<string, unknown> | undefined;
  return row ? hydrate(row) : null;
}

export interface JournalInput {
  day: string;
  title: string;
  body: string;
  pinned: boolean;
}

export function parseJournalInput(raw: unknown): { ok: true; value: JournalInput } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'Malformed page.' };
  const t = raw as Record<string, unknown>;
  const day = typeof t.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.day) ? t.day : null;
  if (!day) return { ok: false, error: 'A page needs a date.' };
  /*
    Nothing is required except the date.

    The rest of this app demands 160 characters before it will record a trade,
    on purpose. A journal has to be the opposite: the entry you write in eight
    words at midnight is the one that turns out to matter, and a minimum is how
    you teach yourself not to open it.
  */
  return {
    ok: true,
    value: {
      day,
      title: typeof t.title === 'string' ? t.title.trim().slice(0, 200) : '',
      body: sanitiseHtml(typeof t.body === 'string' ? t.body : ''),
      pinned: t.pinned === true,
    },
  };
}

export function createJournalPage(input: JournalInput): JournalPage {
  const id = crypto.randomUUID();
  getDb()
    .prepare(`INSERT INTO journal_pages (id, day, title, body, plain, pinned)
              VALUES (@id, @day, @title, @body, @plain, @pinned)`)
    .run({ id, ...input, plain: toPlainText(input.body), pinned: input.pinned ? 1 : 0 });
  return getJournalPage(id)!;
}

export function updateJournalPage(id: string, input: JournalInput): JournalPage | null {
  if (!getJournalPage(id)) return null;
  getDb()
    .prepare(`UPDATE journal_pages
              SET day = @day, title = @title, body = @body, plain = @plain, pinned = @pinned
              WHERE id = @id`)
    .run({ id, ...input, plain: toPlainText(input.body), pinned: input.pinned ? 1 : 0 });
  return getJournalPage(id);
}

/** Restores under the id an export carried, so importing twice is a no-op. */
export function importJournalPage(id: string, input: JournalInput, created_at: string | null): void {
  getDb()
    .prepare(`INSERT INTO journal_pages (id, day, title, body, plain, pinned, created_at)
              VALUES (@id, @day, @title, @body, @plain, @pinned,
                      COALESCE(@created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')))`)
    .run({ id, ...input, plain: toPlainText(input.body), pinned: input.pinned ? 1 : 0, created_at });
}

export function deleteJournalPage(id: string): boolean {
  return getDb().prepare('DELETE FROM journal_pages WHERE id = ?').run(id).changes > 0;
}

/** Days that have at least one page — for the calendar's written-on marker. */
export function journalDays(): string[] {
  return (getDb().prepare('SELECT DISTINCT day FROM journal_pages').all() as { day: string }[])
    .map((r) => r.day);
}
