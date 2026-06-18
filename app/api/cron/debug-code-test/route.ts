import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const NEW_TICKERS = [
  '228A', '4397', '4374', '431A', '4443', '4478', '3994', '4776', '4058', '4811',
  '285A', '4062', '8058', '290A', '247A', '4661', '9984', '5803', '8035', '6752',
  '6981', '6920', '6954',
];

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const before = await redis.get<string[]>('signal:watchlist');
  await redis.set('signal:watchlist', NEW_TICKERS);
  const after = await redis.get<string[]>('signal:watchlist');

  return NextResponse.json({ before, after });
}
