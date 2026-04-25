import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

const MOCK_STOCKS: Record<string, { name: string; base: number; currency: string }> = {
  '7203.T': { name: 'Toyota', base: 3450, currency: 'JPY' },
  '6758.T': { name: 'Sony Group', base: 2890, currency: 'JPY' },
  '8306.T': { name: 'Mitsubishi UFJ', base: 1580, currency: 'JPY' },
  '4519.T': { name: 'Chugai Pharma', base: 6200, currency: 'JPY' },
  'AAPL':   { name: 'Apple Inc.', base: 195, currency: 'USD' },
  'NVDA':   { name: 'NVIDIA Corp.', base: 875, currency: 'USD' },
  'MSFT':   { name: 'Microsoft Corp.', base: 415, currency: 'USD' },
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbols = searchParams.get('symbols')?.split(',') || Object.keys(MOCK_STOCKS)

  const results = await Promise.all(
    symbols.map(async (symbol) => {
      const mock = MOCK_STOCKS[symbol]
      if (!mock) return null

      if (symbol.endsWith('.T')) {
        try {
          const cached: any = await redis.get(`stock:${symbol}`)
          if (cached) {
            const data = typeof cached === 'string' ? JSON.parse(cached) : cached
            return { symbol, name: mock.name, ...data, currency: 'JPY', source: 'jquants' }
          }
        } catch (_) {}
      }

      const changePct = (Math.random() - 0.45) * 4
      const price = mock.base * (1 + changePct / 100)
      return {
        symbol, name: mock.name,
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
