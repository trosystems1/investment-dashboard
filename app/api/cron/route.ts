import { NextRequest, NextResponse } from 'next/server'
import { fetchAndStore } from '@/lib/jquants-fetch'

const CODES = ['228A', '4397', '4374', '431A', '4443', '4478', '3994', '4776', '4058', '4811']

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-vercel-cron')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && cronHeader !== '1') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const data = await fetchAndStore(CODES)
    return NextResponse.json({ success: true, data, executedAt: new Date().toISOString() })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
