import { NextResponse } from 'next/server';
import { clearOffsets, readOffsets, writeOffset } from '@/db/boardlayout';
import { GROUP_MODES, type GroupMode } from '@/lib/layout';

export async function GET() {
  return NextResponse.json(readOffsets());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as
    { mode?: unknown; key?: unknown; dx?: unknown; dy?: unknown } | null;
  const mode = typeof body?.mode === 'string' && (GROUP_MODES as readonly string[]).includes(body.mode)
    ? (body.mode as GroupMode) : null;
  if (!mode || typeof body?.key !== 'string') {
    return NextResponse.json({ error: 'Expected a grouping mode and a group key.' }, { status: 400 });
  }
  const dx = Number(body.dx);
  const dy = Number(body.dy);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
    return NextResponse.json({ error: 'Expected numeric offsets.' }, { status: 400 });
  }
  writeOffset(mode, body.key, dx, dy);
  return NextResponse.json({ ok: true });
}

/** Tidy up: every group back where the grid puts it. */
export async function DELETE() {
  clearOffsets();
  return NextResponse.json({ ok: true });
}
