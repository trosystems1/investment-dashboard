import { NextRequest, NextResponse } from 'next/server'

function generateMockData(symbol: string, range: string) {
  const points: { date: string; value: number }[] = []
  const days = range === '1mo' ? 22 : range === '3mo' ? 66 : range === '6mo' ? 130 : 252
  const baseValues: Record<string, number> = {
    '^N225': 35000, '^GSPC': 5200, 'JPY=X': 150, 'GC=F': 2300, 'BTC-USD': 85000,
  }
  let value = baseValues[symbol] ?? 1000
  const now = new Date()
  for (let i = days; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    if (d.getDay() === 0 || d.getDay() === 6) continue
    value = value * (1 + (Math.random() - 0.485) * 0.015)
    points.push({ date: d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }), value: parseFloat(value.toFixed(2)) })
  }
  return points
}

async function fetchAlphaVantageChart(symbol: string, range: string) {
  const key = process.env.ALPHA_VANTAGE_KEY
  if (!key) return null
  const avFunc = range === '1y' ? 'TIME_SERIES_WEEKLY' : 'TIME_SERIES_DAILY'
  const avSymbol = symbol.startsWith('^') || symbol.includes('=') || symbol.includes('-')
    ? null : symbol.replace('.T', '.TYO')
  if (!avSymbol) return null
  try {
    const url = `https://www.alphavantage.co/query?function=${avFunc}&symbol=${avSymbol}&apikey=${key}`
    const res = await fetch(url, { next: { revalidate: 300 } })
    if (!res.ok) return null
    const data = await res.json()
    const key1 = range === '1y' ? 'Weekly Time Series' : 'Time Series (Daily)'
    const series = data[key1]
    if (!series) return null
    const days = range === '1mo' ? 22 : range === '3mo' ? 66 : range === '6mo' ? 130 : 252
    const points = Object.entries(series)
      .slice(0, days)
      .reverse()
      .map(([date, val]: [string, any]) => ({
        date: new Date(date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
        value: parseFloat(val['4. close']),
      }))
    return points
  } catch (_) { return null }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol') || '^N225'
  const range = searchParams.get('range') || '3mo'

  const live = await fetchAlphaVantageChart(symbol, range)
  if (live && live.length > 0) {
    return NextResponse.json({ data: live, symbol, range, source: 'live' })
  }

  const mockData = generateMockData(symbol, range)
  return NextResponse.json({ data: mockData, symbol, range, source: 'mock' })
}
