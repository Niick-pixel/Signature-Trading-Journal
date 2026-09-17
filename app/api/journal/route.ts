import { NextResponse } from 'next/server';
import { createJournalPage, listJournalPages, parseJournalInput } from '@/db/journal';

export async function GET() {
  return NextResponse.json(listJournalPages());
}

export async function POST(request: Request) {
  const check = parseJournalInput(await request.json().catch(() => null));
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
  return NextResponse.json(createJournalPage(check.value));
}
