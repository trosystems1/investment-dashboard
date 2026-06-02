import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function GET() {
  const tickers = await redis.get<string[]>('signal:watchlist') ?? [];

  // 各銘柄の会社名と履歴を並列取得
  const results = await Promise.all(
    tickers.map(async (ticker) => {
      const [companyName, history] = await Promise.all([
        redis.get<string>(`company:${ticker}`),
        redis.get<Array<{ date: string; signals: string[]; checkedAt: string }>>(`signal:history:${ticker}`),
      ]);
      return {
        ticker,
        companyName: companyName ?? ticker,
        history: history ?? [],
      };
    })
  );

  return NextResponse.json({ watchlist: results });
}
