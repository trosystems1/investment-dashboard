import { NextRequest, NextResponse } from 'next/server'
import { gunzipSync } from 'zlib'
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

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(l => l.trim().length > 0)
  if (lines.length === 0) return []
  const headers = lines[0].split(',').map(h => h.trim())
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = cols[idx]?.trim() ?? '' })
    rows.push(row)
  }
  return rows
}

async function fetchBulkCSV(apiKey: string, endpoint: string, date: string): Promise<Record<string, string>[]> {
  const getUrl = `https://api.jquants.com/v2/bulk/get?endpoint=${encodeURIComponent(endpoint)}&date=${date}`
  const getRes = await fetchWithRetry(getUrl, { 'x-api-key': apiKey })
  const getJson = await getRes.json()
  if (!getJson.url) {
    console.log(`bulk/get response for ${endpoint} ${date}:`, JSON.stringify(getJson))
    return []
  }
  const fileRes = await fetch(getJson.url)
  const buffer = Buffer.from(await fileRes.arrayBuffer())
  const decompressed = gunzipSync(buffer).toString('utf-8')
  return parseCSV(decompressed)
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.JQUANTS_API_KEY!

  try {
    const masterRes = await fetchWithRetry(
      'https://api.jquants.com/v2/equities/master',
      { 'x-api-key': apiKey }
    )
    const masterJson = await masterRes.json()
    const primeStocks = (masterJson.data || []).filter(
      (s: any) => s.Mkt === '0111'
    )

    const today = new Date()

    const target = new Date(today)
    target.setDate(target.getDate() - 1)
    while (target.getDay() === 0 || target.getDay() === 6) {
      target.setDate(target.getDate() - 1)
    }
    const dateStr = target.toISOString().split('T')[0].replace(/-/g, '')

    const primeCodes = primeStocks.map((s: any) => s.Code)

    // 営業日（土日を除く）のリストを作成
    // 四半期決算は約91日ごとに発表されるため、最低でも1四半期分+バッファを確保する
    const LOOKBACK_BUSINESS_DAYS = 70 // 約98暦日 ≒ 1四半期(91日) + 余裕
    const businessDays: string[] = []
    {
      const cursor = new Date(today)
      cursor.setDate(cursor.getDate() - 1) // 今日は決算未確定の可能性があるため前日から
      while (businessDays.length < LOOKBACK_BUSINESS_DAYS) {
        if (cursor.getDay() !== 0 && cursor.getDay() !== 6) {
          businessDays.push(cursor.toISOString().split('T')[0])
        }
        cursor.setDate(cursor.getDate() - 1)
      }
    }

    const finMap: Record<string, any> = {}
    const dailyCounts: Record<string, number> = {}
    for (const day of businessDays) {
      let paginationKey: string | undefined = undefined
      let page = 0
      let dayCount = 0
      do {
        const url: string = `https://api.jquants.com/v2/fins/summary?date=${day}${paginationKey ? `&pagination_key=${paginationKey}` : ''}`
        const finRes = await fetchWithRetry(url, { 'x-api-key': apiKey})
        const finJson = await finRes.json()
        if (page === 0 && finJson.message) {
          console.log(`fins/summary ${day} error message:`, finJson.message)
        }
        dayCount += finJson.data?.length || 0
        for (const r of finJson.data || []) {
          const code = r.Code
          if (!finMap[code] || r.DiscDate > finMap[code].DiscDate) {
            finMap[code] = r
          }
        }
        paginationKey = finJson.pagination_key
        page++
        await sleep(1100) // J-Quants 60req/分のレート制限を避けるためのスリープ
      } while (paginationKey && page < 5)
      dailyCounts[day] = dayCount
    }
    console.log('fins/summary daily counts:', JSON.stringify(dailyCounts))
    console.log('fins/summary lookback days:', LOOKBACK_BUSINESS_DAYS, 'total unique codes:', Object.keys(finMap).length)

    const priceMap: Record<string, number> = {}
    const dateHyphen = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
    try {
      const priceRows = await fetchBulkCSV(apiKey, '/equities/bars/daily', dateHyphen)
      console.log('bulk price rows (raw):', priceRows.length)
      const targetRows = priceRows.filter(r => r.Date === dateHyphen)
      console.log('bulk price rows (filtered to target date):', targetRows.length)
      for (const row of targetRows) {
        const code = row.Code
        const price = parseFloat(row.C)
        if (code && !isNaN(price)) {
          priceMap[code] = price
        }
      }
    } catch (e: any) {
      console.log('bulk price fetch error:', e.message)
    }
    console.log('price fetch summary:', { total: primeCodes.length, success: Object.keys(priceMap).length })

    const screenerData = primeStocks
      .map((s: any) => {
        const code = s.Code
        const fin = finMap[code]
        const price = priceMap[code]
        if (!price || !fin) return null

        const bps = parseFloat(fin.BPS) || 0
        const eps = parseFloat(fin.EPS) || 0
        const feps = parseFloat(fin.FEPS) || 0
        const np = parseFloat(fin.NP) || 0
        const eq = parseFloat(fin.Eq) || 0
        const shOut = parseFloat(fin.ShOutFY) || 0
        const fdivAnn = parseFloat(fin.FDivAnn) || 0
        const sales = parseFloat(fin.Sales) || 0
        const op = parseFloat(fin.OP) || 0

        const pbr = bps > 0 ? price / bps : null
        const per = eps > 0 ? price / eps : null
        const fper = feps > 0 ? price / feps : null
        const roe = eq > 0 ? (np / eq) * 100 : null
        const divYield = fdivAnn > 0 ? (fdivAnn / price) * 100 : null
        const marketCap = shOut > 0 ? price * shOut : null
        const opMargin = sales > 0 ? (op / sales) * 100 : null

        return {
          code: code.slice(0, 4),
          code5: code,
          name: s.CoName,
          sector: s.S33Nm,
          price,
          pbr: pbr ? Math.round(pbr * 100) / 100 : null,
          per: per ? Math.round(per * 100) / 100 : null,
          fper: fper ? Math.round(fper * 100) / 100 : null,
          roe: roe ? Math.round(roe * 100) / 100 : null,
          divYield: divYield ? Math.round(divYield * 100) / 100 : null,
          marketCap: marketCap ? Math.round(marketCap / 1e8) : null,
          opMargin: opMargin ? Math.round(opMargin * 100) / 100 : null,
          updatedAt: new Date().toISOString(),
        }
      })
      .filter(Boolean)

    await redis.set('screener:prime', JSON.stringify(screenerData), { ex: 86400 * 2 })

    return NextResponse.json({
      success: true,
      count: screenerData.length,
      primeCount: primeStocks.length,
      finCount: Object.keys(finMap).length,
      priceCount: Object.keys(priceMap).length,
      executedAt: new Date().toISOString(),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
