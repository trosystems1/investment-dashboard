import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

async function getIdToken(): Promise<string | null> {
  const email = process.env.JQUANTS_EMAIL
  const password = process.env.JQUANTS_PASSWORD
  if (!email || !password) return null
  try {
    const authRes = await fetch('https://api.jquants.com/v1/token/auth_user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mailaddress: email, password }),
    })
    if (!authRes.ok) return null
    const authData = await authRes.json()
    const refreshToken = authData.refreshToken
    if (!refreshToken) return null

    const tokenRes = await fetch(`https://api.jquants.com/v1/token/auth_refresh?refreshtoken=${refreshToken}`, { method: 'POST' })
    if (!tokenRes.ok) return null
    const tokenData = await tokenRes.json()
    return tokenData.idToken || null
  } catch (_) { return null }
}

async function fetchAndStore(codes: string[], idToken: string) {
  const today = new Date()
  const from = new Date(today)
  from.setDate(from.getDate() - 7)
  const fromStr = from.toISOString().split('T')[0]
  const toStr = today.toISOString().split('T')[0]

  const results: any[] = []
  for (const code of codes) {
    try {
      const url = `https://api.jquants.com/v1/prices/daily_quotes?code=${code}&from=${fromStr}&to=${toStr}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } })
      if (!res.ok) continue
      const data = await res.json()
      const quotes = data.daily_quotes || []
      if (quotes.length === 0) continue
      const latest = quotes[quotes.length - 1]
      const prev = quotes.length > 1 ? quotes[quotes.length - 2] : null
      const price = latest.Close
      const prevClose = prev?.Close || price
      const change = price - prevClose
      const changePct = prevClose ? (change / prevClose) * 100 : 0

      const stockData = {
        symbol: code + '.T',
        price: parseFloat(price.toFixed(0)),
        prevClose: parseFloat(prevClose.toFixed(0)),
        change: parseFloat(change.toFixed(0)),
        changePct: parseFloat(changePct.toFixed(2)),
        date: latest.Date,
        open: latest.Open,
        high: latest.High,
        low: latest.Low,
        volume: latest.Volume,
        updatedAt: new Date().toISOString(),
      }

      await redis.set(`stock:${code}.T`, JSON.stringify(stockData), { ex: 86400 })

      const historyKey = `history:${code}.T`
      const existing: any = await redis.get(historyKey) || '[]'
      const history = typeof existing === 'string' ? JSON.parse(existing) : existing
      for (const q of quotes) {
        const dateStr = q.Date
        if (!history.find((h: any) => h.rawDate === dateStr)) {
          history.push({
            date: new Date(dateStr).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
            value: q.Close,
            rawDate: dateStr,
          })
        }
      }
      history.sort((a: any, b: any) => a.rawDate.localeCompare(b.rawDate))
      await redis.set(historyKey, JSON.stringify(history), { ex: 86400 * 365 })

      results.push(stockData)
    } catch (_) { continue }
  }
  return results
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const codes = (searchParams.get('codes') || '7203,6758,8306,4519').split(',')

  const idToken = await getIdToken()
  if (!idToken) return NextResponse.json({ error: 'Failed to get ID token' }, { status: 500 })

  const results = await fetchAndStore(codes, idToken)
  return NextResponse.json({ data: results, updatedAt: new Date().toISOString() })
}
