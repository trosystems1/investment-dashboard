import { NextRequest, NextResponse } from 'next/server'

// リアルに近いモックデータを生成（Yahoo Finance APIが使えない環境用フォールバック）
function generateMockData(symbol: string, range: string) {
  const points: { date: string; value: number }[] = []
  const days = range === '1mo' ? 22 : range === '3mo' ? 66 : range === '6mo' ? 130 : 252

  const baseValues: Record<string, number> = {
    '^N225': 35000, '^GSPC': 5200, 'JPY=X': 150, 'GC=F': 2300, 'BTC-USD': 85000,
    'AAPL': 195, '7203.T': 3500,
  }
  let value = baseValues[symbol] ?? 1000
  const now = new Date()

  for (let i = days; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    if (d.getDay() === 0 || d.getDay() === 6) continue
    value = value * (1 + (Math.random() - 0.485) * 0.015)
    points.push({
      date: d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
      value: parseFloat(value.toFixed(2)),
    })
  }
  return points
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol') || '^N225'
  const range = searchParams.get('range') || '3mo'

  const intervalMap: Record<string, string> = {
    '1mo': '1d', '3mo': '1d', '6mo': '1wk', '1y': '1wk',
  }
  const interval = intervalMap[range] || '1d'

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'ja,en;q=0.9',
  }

  // 複数エンドポイントを試す
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`,
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers, next: { revalidate: 300 } })
      if (!res.ok) continue
      const data = await res.json()
      const result = data.result?.[0]
      if (!result) continue

      const timestamps: number[] = result.timestamp || []
      const closes: number[] = result.indicators?.quote?.[0]?.close || []
      const points = timestamps.map((t: number, i: number) => ({
        date: new Date(t * 1000).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
        value: closes[i] ? parseFloat(closes[i].toFixed(2)) : null,
      })).filter((p: { date: string; value: number | null }) => p.value !== null)

      return NextResponse.json({ data: points, symbol, range, source: 'live' })
    } catch (_) {
      continue
    }
  }

  // フォールバック：モックデータ
  const mockData = generateMockData(symbol, range)
  return NextResponse.json({ data: mockData, symbol, range, source: 'mock' })
}
