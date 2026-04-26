import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

const CODE_MAP: Record<string, string> = {
  '228A': '228A0', '4397': '43970', '4374': '43740',
  '431A': '431A0', '4443': '44430', '4478': '44780',
  '3994': '39940', '4776': '47760', '4058': '40580', '4811': '48110',
}

async function fetchAndStore(codes: string[]) {
  const apiKey = process.env.JQUANTS_API_KEY!
  const today = new Date()
  const target = new Date(today)
  target.setDate(target.getDate() - 1)
  while (target.getDay() === 0 || target.getDay() === 6) {
    target.setDate(target.getDate() - 1)
  }
  const dateStr = target.toISOString().split('T')[0].replace(/-/g, '')
  const results: any[] = []

  for (const code of codes) {
    const jqCode = CODE_MAP[code] || code + '0'
    try {
      const url = `https://api.jquants.com/v2/equities/bars/daily?code=${jqCode}&date=${dateStr}`
      const res = await fetch(url, { headers: { 'x-api-key': apiKey } })
      if (!res.ok) continue
      const json = await res.json()
      const data = json.data?.[0]
      if (!data) continue
      const stockData = {
        symbol: code + '.T',
        price: data.C,
        open: data.O,
        high: data.H,
        low: data.L,
        close: data.C,
        prevClose: data.O,
        change: parseFloat((data.C - data.O).toFixed(0)),
        changePct: parseFloat(((data.C - data.O) / data.O * 100).toFixed(2)),
        volume: data.Vo,
        date: data.Date,
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
