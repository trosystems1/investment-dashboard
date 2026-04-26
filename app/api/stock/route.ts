import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

const MOCK_STOCKS: Record<string, { name: string; base: number; currency: string }> = {
  '228A.T': { name: 'opro', base: 1000, currency: 'JPY' },
  '4397.T': { name: 'TeamSpirit', base: 1000, currency: 'JPY' },
  '4374.T': { name: 'ROBOT PAYMENT', base: 1000, currency: 'JPY' },
  '431A.T': { name: 'Ysona', base: 1000, currency: 'JPY' },
  '4443.T': { name: 'Sansan', base: 1000, currency: 'JPY' },
  '4478.T': { name: 'freee', base: 1000, currency: 'JPY' },
  '3994.T': { name: 'MoneyForward', base: 1000, currency: 'JPY' },
  '4776.T': { name: 'Cybozu', base: 1000, currency: 'JPY' },
  '4058.T': { name: 'Toyokumo', base: 1000, currency: 'JPY' },
  '4811.T': { name: 'Dream Arts', base: 1000, currency: 'JPY' },
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
          const jquantsCode = symbol.replace('.T', '0') + '.T'
          const cached: any = await redis.get(`stock:${jquantsCode}`)
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
        price: parseFloat(price.toFixed(0)),
        prevClose: mock.base,
        change: parseFloat((price - mock.base).toFixed(0)),
        changePct: parseFloat(changePct.toFixed(2)),
        currency: mock.currency,
        source: 'mock',
      }
    })
  )

  return NextResponse.json({ data: results.filter(Boolean) })
}
