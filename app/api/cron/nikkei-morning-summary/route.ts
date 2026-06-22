import { NextResponse } from 'next/server'
import {
  fetchMorningMarketData,
  generateGeminiSummary,
  saveMorningSummary,
  toSummaryRecord,
} from '@/lib/nikkei-morning-summary'

export const maxDuration = 60

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-vercel-cron')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && cronHeader !== '1') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const market = await fetchMorningMarketData()
    let summaryText: string
    try {
      summaryText = await generateGeminiSummary(market)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      summaryText = `（要約生成失敗: ${msg}）\n\n${market.errors.length ? `データ取得エラー: ${market.errors.join(', ')}` : ''}`
    }

    const record = toSummaryRecord(market, summaryText)
    await saveMorningSummary(record)

    return NextResponse.json({
      ok: true,
      date: record.date,
      sqDaysRemaining: record.sq_days_remaining,
      viHigh: market.viHigh,
      errors: market.errors,
      summaryPreview: summaryText.slice(0, 200),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[nikkei-morning-summary]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
