import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

let cachedToken: { value: string; expiry: number } | null = null

async function getApiKey(): Promise<string> {
  if (process.env.JQUANTS_API_KEY) return process.env.JQUANTS_API_KEY
  if (cachedToken && cachedToken.expiry > Date.now()) return cachedToken.value
  const email = process.env.JQUANTS_EMAIL!
  const password = process.env.JQUANTS_PASSWORD!
  const r1 = await fetch('https://api.jquants.com/v1/token/auth_user', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mailaddress: email, password }),
  })
  const { refreshToken } = await r1.json()
  const r2 = await fetch(`https://api.jquants.com/v1/token/auth_refresh?refreshtoken=${refreshToken}`, { method: 'POST' })
  const { idToken } = await r2.json()
  cachedToken = { value: idToken, expiry: Date.now() + 60 * 60 * 1000 }
  return idToken
}

function toJQuantsCode(symbol: string) {
  return symbol.replace('.T', '') + '0'
}

async function fetchFromJQuants(symbol: string): Promise<any> {
  const apiKey = await getApiKey()
  const code = toJQuantsCode(symbol)
  const today = new Date()
  const from = new Date(today)
  from.setDate(from.getDate() - 7)
  const fromStr = from.toISOString().split('T')[0].replace(/-/g, '')
  const toStr = today.toISOString().split('T')[0].replace(/-/g, '')

  const res = await fetch(
    `https://api.jquants.com/v2/equities/bars/daily?code=${code}&from=${fromStr}&to=${toStr}`,
    { headers: { 'x-api-key': apiKey } }
  )
  const json = await res.json()
  const data: any[] = json.data || []
  if (!data.length) return null

  data.sort((a, b) => b.Date.localeCompare(a.Date))
  const latest = data[0]
  const prev = data[1] || latest

  return {
    symbol,
    price: latest.C,
    open: latest.O, high: latest.H, low: latest.L,
    prevClose: prev.C,
    change: parseFloat((latest.C - prev.C).toFixed(0)),
    changePct: parseFloat(((latest.C - prev.C) / prev.C * 100).toFixed(2)),
    volume: latest.Vo,
    date: latest.Date,
    updatedAt: new Date().toISOString(),
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbols = (searchParams.get('symbols') || '').split(',').filter(Boolean)
  if (!symbols.length) return NextResponse.json({ data: [] })

  const results = await Promise.all(
    symbols.map(async (symbol) => {
      // 1. Redis キャッシュ確認
      try {
        const cached: any = await redis.get(`stock:${symbol}`)
        if (cached) {
          const d = typeof cached === 'string' ? JSON.parse(cached) : cached
          return { symbol, name: symbol.replace('.T', ''), ...d, currency: 'JPY', source: 'cache' }
        }
      } catch (_) {}

      // 2. J-Quants から直接取得
      try {
        const d = await fetchFromJQuants(symbol)
        if (d) {
          await redis.set(`stock:${symbol}`, JSON.stringify(d), { ex: 3600 }).catch(() => {})
          return { ...d, name: symbol.replace('.T', ''), currency: 'JPY', source: 'jquants' }
        }
      } catch (_) {}

      return null
    })
  )

  return NextResponse.json({ data: results.filter(Boolean) })
}
