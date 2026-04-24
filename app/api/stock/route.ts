import { NextRequest, NextResponse } from 'next/server'

const MOCK_STOCKS: Record<string, { name: string; base: number; currency: string }> = {
  '7203.T': { name: 'トヨタ自動車', base: 3450, currency: 'JPY' },
  '6758.T': { name: 'ソニーグループ', base: 2890, currency: 'JPY' },
  '8306.T': { name: '三菱UFJフィナンシャル', base: 1580, currency: 'JPY' },
  '4519.T': { name: '中外製薬', base: 6200, currency: 'JPY' },
  'AAPL':   { name: 'Apple Inc.', base: 195, currency: 'USD' },
  'NVDA':   { name: 'NVIDIA Corp.', base: 875, currency: 'USD' },
  'MSFT':   { name: 'Microsoft Corp.', base: 415, currency: 'USD' },
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbols = searchParams.get('symbols')?.split(',') || Object.keys(MOCK_STOCKS)

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'application/json',
  }

  const results = await Promise.all(
    symbols.map(async (symbol) => {
      const urls = [
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
        `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      ]
      for (const url of urls) {
        try {
          const res = await fetch(url, { headers, next: { revalidate: 60 } })
          if (!res.ok) continue
          const data = await res.json()
          const meta = data.result?.[0]?.meta
          if (!meta) continue
          return {
            symbol,
            name: meta.shortName || meta.longName || symbol,
            price: meta.regularMarketPrice ?? 0,
            prevClose: meta.chartPreviousClose ?? 0,
            change: (meta.regularMarketPrice ?? 0) - (meta.chartPreviousClose ?? 0),
            changePct: (((meta.regularMarketPrice ?? 0) - (meta.chartPreviousClose ?? 0)) / (meta.chartPreviousClose ?? 1)) * 100,
            currency: meta.currency || 'JPY',
            source: 'live',
          }
        } catch (_) { continue }
      }

      // モックフォールバック
      const mock = MOCK_STOCKS[symbol]
      if (!mock) return null
      const changePct = (Math.random() - 0.45) * 4
      const price = mock.base * (1 + changePct / 100)
      return {
        symbol,
        name: mock.name,
        price: parseFloat(price.toFixed(mock.currency === 'JPY' ? 0 : 2)),
        prevClose: mock.base,
        change: parseFloat((price - mock.base).toFixed(mock.currency === 'JPY' ? 0 : 2)),
        changePct: parseFloat(changePct.toFixed(2)),
        currency: mock.currency,
        source: 'mock',
      }
    })
  )

  return NextResponse.json({ data: results.filter(Boolean) })
}
