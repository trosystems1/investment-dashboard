import { NextResponse } from 'next/server'
import { fetchUSChartRange, type RangePreset } from '@/lib/us-watchlist'

export async function GET(req: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params
  const { searchParams } = new URL(req.url)
  const presetParam = searchParams.get('range') ?? '3mo'
  const preset: RangePreset = ['1mo', '3mo', '6mo', '1y'].includes(presetParam) ? (presetParam as RangePreset) : '3mo'
  const points = await fetchUSChartRange(ticker.toUpperCase(), preset)
  return NextResponse.json({ points, preset })
}
