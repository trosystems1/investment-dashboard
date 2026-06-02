import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function GET() {
  const tickers = await redis.get<string[]>('signal:watchlist');
  return NextResponse.json({ tickers: tickers ?? [] });
}

export async function POST(req: Request) {
  const { tickers } = await req.json();
  if (!Array.isArray(tickers)) {
    return NextResponse.json({ error: 'Invalid tickers' }, { status: 400 });
  }
  const normalized = tickers
    .map((t: string) => t.trim().toUpperCase())
    .filter(Boolean)
    .map((t: string) => t.endsWith('0') ? t : `${t}0`);
  await redis.set('signal:watchlist', normalized);
  return NextResponse.json({ success: true, tickers: normalized });
}
