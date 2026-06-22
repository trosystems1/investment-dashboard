import { NextResponse } from 'next/server'
import { listAnalystComments } from '@/lib/analyst-comments'

async function fetchTopixSummary() {
  const apiKey = process.env.JQUANTS_API_KEY
  if (!apiKey) return null

  try {
    const to = new Date()
    const from = new Date(to)
    from.setDate(from.getDate() - 14) // 土日・祝日を考慮した余裕分
    const fromStr = from.toISOString().split('T')[0].replace(/-/g, '')
    const toStr = to.toISOString().split('T')[0].replace(/-/g, '')

    const res = await fetch(
      `https://api.jquants.com/v2/indices/bars/daily/topix?from=${fromStr}&to=${toStr}`,
      { headers: { 'x-api-key': apiKey } },
    )
    if (!res.ok) return null
    const json = await res.json()
    const rows = (json.data || []) as { Date: string; C: number }[]
    if (rows.length < 2) return null

    const sorted = [...rows].sort((a, b) => a.Date.localeCompare(b.Date))
    const latest = sorted[sorted.length - 1]
    const prev = sorted[sorted.length - 2]
    const change = latest.C - prev.C
    const changePct = (change / prev.C) * 100

    return {
      date: latest.Date,
      close: latest.C,
      change: Number(change.toFixed(2)),
      changePct: Number(changePct.toFixed(2)),
    }
  } catch {
    return null
  }
}

export async function GET() {
  const [stockComments, cryptoComments, nikkeiComments, topix] = await Promise.all([
    listAnalystComments({ source: 'stock_signal', limit: 2 }),
    listAnalystComments({ source: 'crypto_signal', limit: 2 }),
    listAnalystComments({ source: 'nikkei_option', limit: 1 }),
    fetchTopixSummary(),
  ])

  const stock = stockComments.rows
  const crypto = cryptoComments.rows
  const nikkei = nikkeiComments.rows[0] ?? null

  const stockLatest = (stock[0]?.metadata as any)?.signalCount ?? 0
  const stockPrev = stock[1] ? ((stock[1].metadata as any)?.signalCount ?? 0) : null
  const cryptoLatest = (crypto[0]?.metadata as any)?.triggeredCount ?? 0
  const cryptoPrev = crypto[1] ? ((crypto[1].metadata as any)?.triggeredCount ?? 0) : null

  const totalLatest = stockLatest + cryptoLatest
  const totalPrev = stockPrev != null && cryptoPrev != null ? stockPrev + cryptoPrev : null

  return NextResponse.json({
    configured: stockComments.configured,
    date: stock[0]?.comment_date ?? crypto[0]?.comment_date ?? null,
    signals: {
      total: totalLatest,
      stock: stockLatest,
      crypto: cryptoLatest,
      prevTotal: totalPrev,
      delta: totalPrev != null ? totalLatest - totalPrev : null,
    },
    topix,
    nikkeiSummary: nikkei
      ? {
          date: nikkei.comment_date,
          title: nikkei.title,
          content: nikkei.content,
        }
      : null,
  })
}
