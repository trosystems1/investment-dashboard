import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { reconcileLastRun, type SignalLastRun } from '@/lib/signal-run';

const redis = Redis.fromEnv();

const DEFAULT_TICKERS = ['228A0', '43970', '43740', '431A0', '44430', '44780', '39940', '47760', '40580', '48110'];

export async function GET() {
  const [rules, prompt, lastRun, watchlist] = await Promise.all([
    redis.get<string[]>('signal:rules'),
    redis.get<string>('signal:prompt'), // 旧形式の互換
    redis.get<SignalLastRun>('signal:last_run'),
    redis.get<string[]>('signal:watchlist'),
  ]);
  const tickers = (watchlist && watchlist.length > 0) ? watchlist : DEFAULT_TICKERS;
  const reconciled = await reconcileLastRun(redis, lastRun ?? null, tickers);
  return NextResponse.json({
    rules: rules ?? (prompt ? [prompt] : []),
    prompt: prompt ?? '',
    lastRun: reconciled,
  });
}

export async function POST(req: Request) {
  const body = await req.json();

  // 複数ルール形式
  if (Array.isArray(body.rules)) {
    await redis.set('signal:rules', body.rules);
    return NextResponse.json({ success: true });
  }

  // 旧形式の互換（単一プロンプト）
  if (typeof body.prompt === 'string') {
    await redis.set('signal:prompt', body.prompt.trim());
    await redis.set('signal:rules', [body.prompt.trim()]);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
}
