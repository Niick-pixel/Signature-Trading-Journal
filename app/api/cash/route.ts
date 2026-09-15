import { NextResponse } from 'next/server';
import { createCashEvent, listCashEvents, parseCashInput } from '@/db/cash';

export async function GET() {
  return NextResponse.json(listCashEvents());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const check = parseCashInput(body);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
  return NextResponse.json(createCashEvent(check.value));
}
