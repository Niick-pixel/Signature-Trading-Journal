import { NextResponse } from 'next/server';
import { deleteJournalPage, getJournalPage, parseJournalInput, updateJournalPage } from '@/db/journal';

export async function GET(_r: Request, ctx: { params: Promise<{ id: string }> }) {
  const page = getJournalPage((await ctx.params).id);
  return page ? NextResponse.json(page) : NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const check = parseJournalInput(await request.json().catch(() => null));
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
  const updated = updateJournalPage((await ctx.params).id, check.value);
  return updated ? NextResponse.json(updated) : NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function DELETE(_r: Request, ctx: { params: Promise<{ id: string }> }) {
  return deleteJournalPage((await ctx.params).id)
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'Not found' }, { status: 404 });
}
