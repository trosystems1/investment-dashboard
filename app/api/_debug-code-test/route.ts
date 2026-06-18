import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.JQUANTS_API_KEY;
  const tickers = (await redis.get<string[]>('signal:watchlist')) ?? [];

  const from = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
  const to = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const results: Record<string, { original: string; stripped: string; originalOk: boolean; strippedOk: boolean; strippedRowCount: number | null }> = {};

  for (const ticker of tickers) {
    const stripped = ticker.endsWith('0') ? ticker.slice(0, -1) : ticker;

    const [origRes, stripRes] = await Promise.all([
      fetch(`https://api.jquants.com/v2/equities/bars/daily?code=${ticker}&from=${from}&to=${to}`, {
        headers: { 'x-api-key': apiKey! },
      }),
      stripped !== ticker
        ? fetch(`https://api.jquants.com/v2/equities/bars/daily?code=${stripped}&from=${from}&to=${to}`, {
            headers: { 'x-api-key': apiKey! },
          })
        : Promise.resolve(null),
    ]);

    const origOk = origRes.ok;
    let stripOk = false;
    let stripCount: number | null = null;
    if (stripRes) {
      stripOk = stripRes.ok;
      if (stripOk) {
        const data = await stripRes.json();
        const rows = data.data ?? data.bars ?? [];
        stripCount = Array.isArray(rows) ? rows.length : null;
      }
    }

    results[ticker] = {
      original: ticker,
      stripped,
      originalOk: origOk,
      strippedOk: stripped === ticker ? origOk : stripOk,
      strippedRowCount: stripCount,
    };
  }

  return NextResponse.json({ results });
}
