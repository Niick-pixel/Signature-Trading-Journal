import path from 'node:path';
import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { backupNow, listBackups } from '@/db/backup';

export const dynamic = 'force-dynamic';

/** The newest copy on disk, for Settings. */
export async function GET() {
  getDb(); // opening the journal is what takes the daily copy
  const latest = listBackups()[0] ?? null;
  return NextResponse.json({ latest, count: listBackups().length });
}

/** A copy right now, on demand — before a risky edit, say. */
export async function POST() {
  try {
    const file = backupNow(getDb());
    const latest = listBackups().find((b) => b.name === path.basename(file)) ?? listBackups()[0] ?? null;
    return NextResponse.json({ latest, count: listBackups().length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Backup failed.' }, { status: 500 });
  }
}
