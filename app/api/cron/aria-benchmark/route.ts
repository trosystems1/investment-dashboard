import { NextResponse } from 'next/server'
import { collectBenchmarkInsights, pushInsightsToN8n } from '@/lib/aria-benchmark'

export const maxDuration = 60

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-vercel-cron')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && cronHeader !== '1') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { insights, errors } = await collectBenchmarkInsights()
    await pushInsightsToN8n(insights)

    return NextResponse.json({
      ok: true,
      insightCount: insights.length,
      errors,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[cron/aria-benchmark]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
