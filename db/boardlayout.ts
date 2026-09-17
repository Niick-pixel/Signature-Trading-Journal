import 'server-only';
import { getDb } from './index';
import type { GroupMode } from '../lib/layout';

const KEY = 'cluster_offsets';

/**
 * Where each group has been dragged to, relative to where the grid put it.
 *
 * Cards are placed entirely by the layout now, so their own coordinates are no
 * longer written — but dragging a whole group somewhere meaningful still is.
 * Storing an OFFSET rather than an absolute position means the arrangement
 * survives a group growing, shrinking, or being re-sorted: the grid moves the
 * group and your nudge moves with it.
 *
 * Keyed by grouping mode too, because "where I put the Revenge pile" is a fact
 * about the board organised by reason and means nothing when it is organised by
 * month.
 */
export type ClusterOffsets = Record<string, { dx: number; dy: number }>;

const slot = (mode: GroupMode, key: string) => `${mode}::${key}`;

export function readOffsets(): ClusterOffsets {
  const row = getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(KEY) as
    { value: string } | undefined;
  if (!row) return {};
  try {
    const parsed: unknown = JSON.parse(row.value);
    return parsed && typeof parsed === 'object' ? (parsed as ClusterOffsets) : {};
  } catch {
    // A corrupt blob must not take the board down; a lost nudge is recoverable.
    return {};
  }
}

export function writeOffset(mode: GroupMode, key: string, dx: number, dy: number): void {
  const all = readOffsets();
  if (dx === 0 && dy === 0) delete all[slot(mode, key)];
  else all[slot(mode, key)] = { dx, dy };
  getDb()
    .prepare('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(KEY, JSON.stringify(all));
}

export function clearOffsets(): void {
  getDb().prepare('DELETE FROM app_settings WHERE key = ?').run(KEY);
}
