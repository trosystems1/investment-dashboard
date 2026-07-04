import { NextResponse } from 'next/server'
import { listAriaDailyInsights } from '@/lib/aria-daily'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  let limit = parseInt(searchParams.get('limit') || '30', 10)
  if (Number.isNaN(limit) || limit < 1) limit = 30
  if (limit > 90) limit = 90

  const rows = await listAriaDailyInsights(limit)
  if (rows.length === 0 && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    return NextResponse.json({
      insights: [],
      configured: false,
      message: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です',
    })
  }

  return NextResponse.json({ insights: rows, configured: true })
}
