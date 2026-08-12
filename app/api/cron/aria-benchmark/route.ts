import { NextResponse } from 'next/server'
import { collectBenchmarkInsights } from '@/lib/aria-benchmark'
import { saveBenchmarkInsights, dateJST } from '@/lib/aria-hub'

export const maxDuration = 60

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-vercel-cron')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && cronHeader !== '1') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { insights, errors } = await collectBenchmarkInsights()

    // 保存先はSupabase(aria_benchmark_insights)。
    // 旧経路(n8n webhook aria-benchmark-ingest)は停止済みのため使用しない。
    const analysisDate = dateJST()
    await saveBenchmarkInsights(
      insights.map(i => ({
        analysisDate,
        channelName: i.channelName,
        videoTitle: i.videoTitle,
        focusThemes: i.focusThemes,
        sourceUrl: i.sourceUrl,
      }))
    )

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
