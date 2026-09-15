import { NextResponse } from 'next/server';
import { deleteCashEvent } from '@/db/cash';

export async function DELETE(_r: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return deleteCashEvent(id)
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'Not found' }, { status: 404 });
}
