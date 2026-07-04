import { NextResponse } from 'next/server'
import { buildFacts, fetchAriaDailyData, saveAriaDailyInsight, toAriaDailyRecord } from '@/lib/aria-daily'

export const maxDuration = 60

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-vercel-cron')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && cronHeader !== '1') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const data = await fetchAriaDailyData()
    const facts = buildFacts(data)
    const record = toAriaDailyRecord(data, facts)
    await saveAriaDailyInsight(record)

    return NextResponse.json({
      ok: true,
      date: record.date,
      facts,
      errors: data.errors,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[cron/aria-daily]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
