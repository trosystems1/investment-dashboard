import { NextResponse } from 'next/server'
import { listBenchmarkInsights } from '@/lib/aria-hub'

// GET: 直近の競合分析インサイトを取得（n8n・ダッシュボードページ両方から利用）
export async function GET() {
  const rows = await listBenchmarkInsights(20)
  return NextResponse.json({ insights: rows })
}
