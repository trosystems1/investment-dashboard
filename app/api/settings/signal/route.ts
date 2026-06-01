import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function GET() {
  const [prompt, lastRun] = await Promise.all([
    redis.get<string>('signal:prompt'),
    redis.get('signal:last_run'),
  ]);
  return NextResponse.json({ prompt: prompt ?? '', lastRun: lastRun ?? null });
}

export async function POST(req: Request) {
  const { prompt } = await req.json();
  if (typeof prompt !== 'string') {
    return NextResponse.json({ error: 'Invalid prompt' }, { status: 400 });
  }
  await redis.set('signal:prompt', prompt.trim());
  return NextResponse.json({ success: true });
}
