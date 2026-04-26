import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

async function fetchAndStore(codes: string[]) {
  const apiKey = process.env.JQUANTS_API_KEY!
  const today = new Date()
  const from = new Date(today)
  from.setDate(from.getDate() - 7)
  const fromStr = from.toISOString().split('T')[0]
  const toStr = today.toISOString().split('T')[0]
  const results: any[] = []

  for (const code of codes) {
    try {
      const url = `https://api.jquants.com/v1/prices/daily_quotes?code=${code}&from=${fromStr}&to=${toStr}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
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
      results.push(stockData)
    } catch (_) { continue }
  }
  return results
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const codes = (searchParams.get('codes') || '228A,4397,4374').split(',')
  const results = await fetchAndStore(codes)
  return NextResponse.json({ data: results, updatedAt: new Date().toISOString() })
}
