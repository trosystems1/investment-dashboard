import { NextResponse } from 'next/server'
import { fetchUSChartRange, type RangePreset } from '@/lib/us-watchlist'

export async function GET(req: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params
  const { searchParams } = new URL(req.url)
  const presetParam = searchParams.get('range') ?? 'month'
  const preset: RangePreset = ['day', 'month', 'year'].includes(presetParam) ? (presetParam as RangePreset) : 'month'
  const points = await fetchUSChartRange(ticker.toUpperCase(), preset)
  return NextResponse.json({ points, preset })
}
