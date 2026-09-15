import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function fetchWithRetry(url: string, headers: Record<string, string>, retries = 5): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, { headers })
    if (res.status !== 429) return res
    await sleep(2000 * (i + 1))
  }
  throw new Error('Rate limit exceeded after retries')
}

type ValuationRow = {
  Date: string
  Code: string
  EPS: number | null
  FwdEPS: number | null
  BPS: number | null
  ROE: number | null
  FwdROE: number | null
  PER: number | null
  FwdPER: number | null
  PBR: number | null
  MktCap: number | null
}

/** 指定日の全上場銘柄のバリュエーション指標を、ページングを辿って全件取得する */
async function fetchValuation(apiKey: string, date: string): Promise<ValuationRow[]> {
  const all: ValuationRow[] = []
  let paginationKey: string | undefined = undefined
  let page = 0

  do {
    const url: string = `https://api.jquants.com/v2/equities/valuation?date=${date}${paginationKey ? `&pagination_key=${encodeURIComponent(paginationKey)}` : ''}`
    const res = await fetchWithRetry(url, { 'x-api-key': apiKey })
    if (!res.ok) throw new Error(`valuation ${date}: ${res.status}`)
    const json = await res.json()
    all.push(...(json.data ?? []))
    paginationKey = json.pagination_key
    page++
    if (paginationKey) await sleep(1100)
  } while (paginationKey && page < 20)

  return all
}

const round2 = (v: number | null | undefined) =>
  v == null ? null : Math.round(v * 100) / 100

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.JQUANTS_API_KEY!

  try {
    // 銘柄マスタ（社名・市場区分・業種）。市場区分での絞り込みはしない = 全上場銘柄が対象
    const masterRes = await fetchWithRetry(
      'https://api.jquants.com/v2/equities/master',
      { 'x-api-key': apiKey },
    )
    const masterJson = await masterRes.json()
    const stocks = masterJson.data ?? []
    const masterMap: Record<string, any> = {}
    for (const s of stocks) masterMap[s.Code] = s

    // 前営業日を対象日とする。データ未反映なら1日ずつ遡る（最大5営業日）
    const cursor = new Date()
    cursor.setDate(cursor.getDate() - 1)

    let rows: ValuationRow[] = []
    let usedDate = ''
    for (let i = 0; i < 5; i++) {
      while (cursor.getDay() === 0 || cursor.getDay() === 6) {
        cursor.setDate(cursor.getDate() - 1)
      }
      const d = cursor.toISOString().split('T')[0]
      rows = await fetchValuation(apiKey, d)
      if (rows.length) { usedDate = d; break }
      console.log(`valuation ${d}: no rows, going back one day`)
      cursor.setDate(cursor.getDate() - 1)
    }

    if (!rows.length) {
      return NextResponse.json({ error: 'no valuation data in the last 5 business days' }, { status: 500 })
    }

    // ETF・ETN・REIT等は全指標が Null で返るため、PER と PBR の両方が無い行は落とす
    const screenerData = rows
      .filter(r => r.PER != null || r.PBR != null)
      .map(r => {
        const m = masterMap[r.Code]
        return {
          code: r.Code.slice(0, 4),
          code5: r.Code,
          name: m?.CoName ?? null,
          sector: m?.S33Nm ?? null,
          market: m?.MktNm ?? null,
          eps: round2(r.EPS),
          feps: round2(r.FwdEPS),
          bps: round2(r.BPS),
          // ROE は小数で返るため %表記に直す（0.2310 → 23.1）
          roe: r.ROE == null ? null : Math.round(r.ROE * 10000) / 100,
          froe: r.FwdROE == null ? null : Math.round(r.FwdROE * 10000) / 100,
          per: round2(r.PER),
          fper: round2(r.FwdPER),
          pbr: round2(r.PBR),
          // MktCap は百万円単位。億円に揃える
          marketCap: r.MktCap == null ? null : Math.round(r.MktCap / 100),
          date: r.Date,
          updatedAt: new Date().toISOString(),
        }
      })

    await redis.set('screener:all', JSON.stringify(screenerData), { ex: 86400 * 2 })

    const byMarket: Record<string, number> = {}
    for (const s of screenerData) {
      const k = s.market ?? 'unknown'
      byMarket[k] = (byMarket[k] ?? 0) + 1
    }

    return NextResponse.json({
      success: true,
      date: usedDate,
      count: screenerData.length,
      fetched: rows.length,
      masterCount: stocks.length,
      byMarket,
      executedAt: new Date().toISOString(),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
