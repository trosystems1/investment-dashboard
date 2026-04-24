import { NextRequest, NextResponse } from 'next/server'

const MOCK_STOCKS: Record<string, { name: string; base: number; currency: string }> = {
  '7203.T': { name: 'Toyota', base: 3450, currency: 'JPY' },
  '6758.T': { name: 'Sony Group', base: 2890, currency: 'JPY' },
  '8306.T': { name: 'Mitsubishi UFJ', base: 1580, currency: 'JPY' },
  '4519.T': { name: 'Chugai Pharma', base: 6200, currency: 'JPY' },
  'AAPL': { name: 'Apple Inc.', base: 195, currency: 'USD' },
  'NVDA': { name: 'NVIDIA Corp.', base: 875, currency: 'USD' },
  'MSFT': { name: 'Microsoft Corp.', base: 415, currency: 'USD' },
}

async function fetchAlphaVantage(symbol: string) {
  const key = process.env.ALPHA_VANTAGE_KEY
  if (!key) return null
  const av_symbol = symbol.replace('.T', '.TYO')
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${av_symbol}&apikey=${key}`
  try {
    const res = await fetch(url, { next: { revalidate: 60 } })
    if (!res.ok) return null
    const data = await res.json()
    const q = data['Global Quote']
    if (!q || !q['05. price']) return null
    const price = parseFloat(q['05. price'])
    const prevClose = parseFloat(q['08. previous close'])
    const change = parseFloat(q['09. change'])
    const changePct = parseFloat(q['10. change percent'].replace('%', ''))
    return { price, prevClose, change, changePct }
  } catch (_) { return null }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbols = searchParams.get('symbols')?.split(',') || Object.keys(MOCK_STOCKS)

  const results = await Promise.all(
    symbols.map(async (symbol) => {
      const mock = MOCK_STOCKS[symbol]
      if (!mock) return null

      const live = await fetchAlphaVantage(symbol)
      if (live) {
        return {
          symbol,
          name: mock.name,
          price: live.price,
          prevClose: live.prevClose,
          change: live.change,
          changePct: live.changePct,
          currency: mock.currency,
          source: 'live',
        }
      }

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
