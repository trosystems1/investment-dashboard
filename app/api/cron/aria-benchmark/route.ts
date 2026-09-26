import { NextResponse } from 'next/server'
import { collectBenchmarkInsights } from '@/lib/aria-benchmark'
import { saveBenchmarkInsights, dateJST } from '@/lib/aria-hub'

export const maxDuration = 60

export async function GET(req: Request) {
  // Vercel Cron は Authorization: Bearer <CRON_SECRET> を自動付与する。
  // x-vercel-cron ヘッダーは外部から偽装できるため認証には使わない。
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
