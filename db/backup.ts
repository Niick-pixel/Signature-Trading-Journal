import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { BACKUPS_DIR, DB_PATH } from '../lib/paths';
import { localDay } from '../lib/day';

/** Thirty days is long enough to notice a mistake and still find the version before it. */
const KEEP = 30;

// The local date: a backup taken at 7pm in Costa Rica belongs to today, not to
// tomorrow in UTC.
const stamp = (d = new Date()) => localDay(d);
const fileFor = (day: string) => path.join(BACKUPS_DIR, `journal-${day}.db`);

/**
 * One copy per day, taken on boot.
 *
 * Copying journal.db with fs.copyFile would be wrong: WAL mode means the most
 * recent trades can still be sitting in journal.db-wal, so a plain file copy
 * can silently miss them. SQLite's own VACUUM INTO writes a single consistent
 * database file with everything in it, which is the whole point.
 */
export function backupToday(db: DatabaseSync): string | null {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  const target = fileFor(stamp());

  // Already done today. Taking it once per day rather than once per launch
  // keeps a day of work recoverable without 40 copies of the same journal.
  if (fs.existsSync(target)) return null;

  // VACUUM INTO refuses to overwrite, so a crashed half-write must be cleared.
  const partial = `${target}.partial`;
  fs.rmSync(partial, { force: true });

  db.exec(`VACUUM INTO '${partial.replace(/'/g, "''")}'`);
  fs.renameSync(partial, target);

  pruneOldBackups();
  return target;
}

/** Keeps the newest KEEP files and deletes the rest. */
export function pruneOldBackups(): void {
  if (!fs.existsSync(BACKUPS_DIR)) return;
  const files = fs.readdirSync(BACKUPS_DIR)
    // Daily copies and on-demand ones alike: KEEP is a cap on the folder,
    // not only on the daily copies, or "Back up now" would grow it forever.
    .filter((f) => /^journal-\d{4}-\d{2}-\d{2}.*\.db$/.test(f))
    .sort()
    .reverse();
  for (const stale of files.slice(KEEP)) {
    fs.rmSync(path.join(BACKUPS_DIR, stale), { force: true });
  }
}

export interface BackupFile { name: string; bytes: number; taken: string }

export function listBackups(): BackupFile[] {
  if (!fs.existsSync(BACKUPS_DIR)) return [];
  return fs.readdirSync(BACKUPS_DIR)
    .filter((f) => f.endsWith('.db'))
    .map((name) => {
      const s = fs.statSync(path.join(BACKUPS_DIR, name));
      return { name, bytes: s.size, taken: s.mtime.toISOString() };
    })
    .sort((a, b) => b.name.localeCompare(a.name));
}

/** A copy taken right now, on demand, separate from the daily one. */
export function backupNow(db: DatabaseSync): string {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  const name = `journal-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
  const target = path.join(BACKUPS_DIR, name);
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  pruneOldBackups();
  return target;
}

export { DB_PATH };
