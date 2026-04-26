import { NextRequest, NextResponse } from 'next/server'

const CODES = ['228A', '4397', '4374', '431A', '4443', '4478', '3994', '4776', '4058', '4811']

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/jquants?codes=${CODES.join(',')}`)
    const data = await res.json()
    return NextResponse.json({ success: true, data, executedAt: new Date().toISOString() })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
