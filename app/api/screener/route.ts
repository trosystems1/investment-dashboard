import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

export async function GET() {
  try {
    const raw = await redis.get('screener:prime')
    if (!raw) {
      return NextResponse.json({ data: [], message: 'No data yet. Run cron first.' })
    }
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
