import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { sendLINE } from '@/lib/line';

const redis = Redis.fromEnv();

const DEFAULT_TICKERS = ['228A0', '43970', '43740', '431A0', '44430', '44780', '39940', '47760', '40580', '48110'];

async function fetchBars(ticker: string, days: number = 30) {
  const apiKey = process.env.JQUANTS_API_KEY;
  const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
  const to   = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const res = await fetch(
    `https://api.jquants.com/v2/equities/bars/daily?code=${ticker}&from=${from}&to=${to}`,
    { headers: { 'x-api-key': apiKey! } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return (data.bars ?? []) as Array<{ date: string; close: number; volume: number }>;
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [prompt, savedTickers] = await Promise.all([
    redis.get<string>('signal:prompt'),
    redis.get<string[]>('signal:watchlist'),
  ]);

  if (!prompt) {
    return NextResponse.json({ skipped: 'No signal prompt configured' });
  }

  const tickers = (savedTickers && savedTickers.length > 0) ? savedTickers : DEFAULT_TICKERS;
  const signals: string[] = [];

  for (const ticker of tickers) {
    const bars = await fetchBars(ticker, 30);
    if (!bars || bars.length < 5) continue;

    const recentBars = bars.slice(-25).map(b => ({
      date: b.date, close: b.close, volume: b.volume,
    }));

    const userMessage = `
以下は ${ticker} の直近の株価データ（日次）です。
${JSON.stringify(recentBars, null, 2)}

【シグナル検出ルール】
${prompt}

上記ルールに基づき判断してください。
シグナルあり → SIGNAL: [シグナル名] - [理由1行]
シグナルなし → NO_SIGNAL
`.trim();

    try {
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          messages: [{ role: 'user', content: userMessage }],
        }),
      });
      const claudeData = await claudeRes.json();
      const text: string = claudeData.content?.[0]?.text ?? '';
      if (text.includes('SIGNAL:')) {
        const companyName = await redis.get<string>(`company:${ticker}`) ?? ticker;
        signals.push(`📈 ${companyName}（${ticker}）\n${text.replace('SIGNAL:', '').trim()}`);
      }
    } catch (e) {
      console.error(`Claude error for ${ticker}:`, e);
    }
  }

  if (signals.length > 0) {
    const now = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const message = `🔔 株価シグナル検出 (${now})\n\n${signals.join('\n\n')}`;
    await sendLINE(message);
  }

  await redis.set('signal:last_run', {
    timestamp: new Date().toISOString(),
    signalCount: signals.length,
    signals,
    tickerCount: tickers.length,
  });

  return NextResponse.json({ success: true, signalCount: signals.length, signals, tickerCount: tickers.length });
}
