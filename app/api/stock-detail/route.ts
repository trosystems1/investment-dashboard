import { NextRequest, NextResponse } from 'next/server'

const STOCK_META: Record<string, {
  name: string; nameEn: string; sector: string;
  base: number; high52: number; low52: number;
  per: number; perFwd: number; pbr: number;
  dividend: number; dividendYield: number;
  marketCap: number; eps: number; roe: number;
}> = {
  '7203.T': { name: 'トヨタ自動車', nameEn: 'Toyota Motor', sector: '輸送用機器', base: 3450, high52: 3890, low52: 2680, per: 9.2, perFwd: 8.7, pbr: 1.1, dividend: 75, dividendYield: 2.17, marketCap: 56200, eps: 374, roe: 12.3 },
  '6758.T': { name: 'ソニーグループ', nameEn: 'Sony Group', sector: '電気機器', base: 2890, high52: 3280, low52: 2200, per: 18.4, perFwd: 16.2, pbr: 2.3, dividend: 35, dividendYield: 1.21, marketCap: 18400, eps: 157, roe: 13.1 },
  '8306.T': { name: '三菱UFJフィナンシャル', nameEn: 'MUFG', sector: '銀行業', base: 1580, high52: 1820, low52: 1120, per: 11.2, perFwd: 10.4, pbr: 0.9, dividend: 41, dividendYield: 2.59, marketCap: 21300, eps: 141, roe: 8.2 },
  '4519.T': { name: '中外製薬', nameEn: 'Chugai Pharma', sector: '医薬品', base: 6200, high52: 7100, low52: 4800, per: 28.5, perFwd: 24.1, pbr: 6.8, dividend: 108, dividendYield: 1.74, marketCap: 10200, eps: 217, roe: 24.6 },
  '9984.T': { name: 'ソフトバンクグループ', nameEn: 'SoftBank Group', sector: '情報・通信業', base: 9200, high52: 11200, low52: 7400, per: 42.1, perFwd: 32.4, pbr: 1.4, dividend: 44, dividendYield: 0.48, marketCap: 15800, eps: 218, roe: 3.4 },
  '6861.T': { name: 'キーエンス', nameEn: 'Keyence', sector: '電気機器', base: 65000, high52: 75000, low52: 52000, per: 45.2, perFwd: 40.1, pbr: 7.2, dividend: 320, dividendYield: 0.49, marketCap: 158000, eps: 1438, roe: 16.8 },
}

function generateHistory(base: number, days: number) {
  const points = []
  let val = base * (1 - (Math.random() * 0.08))
  const now = new Date()
  for (let i = days; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    if (d.getDay() === 0 || d.getDay() === 6) continue
    val = val * (1 + (Math.random() - 0.485) * 0.014)
    points.push({
      date: d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
      value: parseFloat(val.toFixed(0)),
    })
  }
  // 最後の値を base に近づける
  if (points.length > 0) points[points.length - 1].value = base
  return points
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get('ticker') || '7203.T'
  const range = searchParams.get('range') || '3mo'

  const meta = STOCK_META[ticker]
  if (!meta) {
    return NextResponse.json({ error: 'Unknown ticker' }, { status: 404 })
  }

  // Yahoo Finance から取得を試みる
  const days = range === '1mo' ? 22 : range === '3mo' ? 66 : range === '6mo' ? 130 : 252
  const interval = range === '1y' ? '1wk' : '1d'

  let history: { date: string; value: number }[] = []
  let source = 'mock'

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      next: { revalidate: 300 },
    })
    if (res.ok) {
      const data = await res.json()
      const result = data.result?.[0]
      if (result) {
        const timestamps: number[] = result.timestamp || []
        const closes: number[] = result.indicators?.quote?.[0]?.close || []
        history = timestamps.map((t: number, i: number) => ({
          date: new Date(t * 1000).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
          value: closes[i] ? parseFloat(closes[i].toFixed(0)) : null,
        })).filter((p: any): p is { date: string; value: number } => p.value !== null)

        // メタ情報も上書き
        const m = result.meta
        if (m?.regularMarketPrice) meta.base = m.regularMarketPrice
        if (m?.fiftyTwoWeekHigh) meta.high52 = m.fiftyTwoWeekHigh
        if (m?.fiftyTwoWeekLow) meta.low52 = m.fiftyTwoWeekLow
        source = 'live'
      }
    }
  } catch (_) {}

  if (!history.length) {
    history = generateHistory(meta.base, days)
    source = 'mock'
  }

  const price = meta.base
  const prevClose = price * (1 + (Math.random() - 0.5) * 0.02)
  const change = price - prevClose
  const changePct = (change / prevClose) * 100

  // 水位計算: 52週レンジ内での位置 (0-100%)
  const waterLevel = Math.round(((price - meta.low52) / (meta.high52 - meta.low52)) * 100)

  return NextResponse.json({
    ticker,
    ...meta,
    price,
    change: parseFloat(change.toFixed(0)),
    changePct: parseFloat(changePct.toFixed(2)),
    currency: 'JPY',
    waterLevel,
    history,
    source,
  })
}
