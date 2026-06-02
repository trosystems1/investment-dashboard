import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function GET() {
  const [rules, prompt, lastRun] = await Promise.all([
    redis.get<string[]>('signal:rules'),
    redis.get<string>('signal:prompt'), // 旧形式の互換
    redis.get('signal:last_run'),
  ]);
  return NextResponse.json({
    rules: rules ?? (prompt ? [prompt] : []),
    prompt: prompt ?? '',
    lastRun: lastRun ?? null,
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
