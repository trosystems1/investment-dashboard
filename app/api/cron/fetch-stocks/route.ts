import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

const STOCKS = [
  { code: '228A0', symbol: '228A.T' },
  { code: '43970', symbol: '4397.T' },
  { code: '43740', symbol: '4374.T' },
  { code: '431A0', symbol: '431A.T' },
  { code: '44430', symbol: '4443.T' },
  { code: '44780', symbol: '4478.T' },
  { code: '39940', symbol: '3994.T' },
  { code: '47760', symbol: '4776.T' },
  { code: '40580', symbol: '4058.T' },
  { code: '48110', symbol: '4811.T' },
]

export async function GET(req: NextRequest) {
  const apiKey = process.env.JQUANTS_API_KEY!
  const today = new Date()
  const target = new Date(today)
  target.setDate(target.getDate() - 2)
  while (target.getDay() === 0 || target.getDay() === 6) {
    target.setDate(target.getDate() - 1)
  }
  const dateStr = target.toISOString().slice(0, 10).replace(/-/g, '')

  for (const stock of STOCKS) {
    try {
      const res = await fetch(
        `https://api.jquants.com/v2/equities/bars/daily?code=${stock.code}&date=${dateStr}`,
        { headers: { 'X-API-KEY': apiKey } }
      )
      const json = await res.json()
      const data = json.data?.[0]
      if (!data) continue
      const change = data.C - data.O
      const changePct = ((data.C - data.O) / data.O) * 100
      const stockData = {
        symbol: stock.symbol,
        price: data.C,
        open: data.O,
        high: data.H,
        low: data.L,
        close: data.C,
        prevClose: data.O,
        change: parseFloat(change.toFixed(0)),
        changePct: parseFloat(changePct.toFixed(2)),
        volume: data.Vo,
        date: data.Date,
        updatedAt: new Date().toISOString(),
      }
      await redis.set(`stock:${stock.symbol}`, JSON.stringify(stockData))
    } catch (e) {
      console.error(`Error fetching ${stock.code}:`, e)
    }
  }
  return NextResponse.json({ success: true, date: dateStr })
}
