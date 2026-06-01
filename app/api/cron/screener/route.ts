import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.JQUANTS_API_KEY!

  try {
    const masterRes = await fetch('https://api.jquants.com/v2/equities/master', {
      headers: { 'x-api-key': apiKey },
    })
    const masterJson = await masterRes.json()
    const primeStocks = (masterJson.data || []).filter(
      (s: any) => s.Mkt === '0111'
    )

    const today = new Date()
    const from = new Date(today)
    from.setDate(from.getDate() - 90)
    const fromStr = from.toISOString().split('T')[0]
    const toStr = today.toISOString().split('T')[0]

    const target = new Date(today)
    target.setDate(target.getDate() - 1)
    while (target.getDay() === 0 || target.getDay() === 6) {
      target.setDate(target.getDate() - 1)
    }
    const dateStr = target.toISOString().split('T')[0].replace(/-/g, '')

    const primeCodes = primeStocks.map((s: any) => s.Code)

    const finMap: Record<string, any> = {}
    let paginationKey: string | undefined = undefined
    let page = 0
    do {
      const url = `https://api.jquants.com/v2/fins/summary?from=${fromStr}&to=${toStr}${paginationKey ? `&pagination_key=${paginationKey}` : ''}`
      console.log('fins/summary URL:', url)
      const finRes = await fetch(url, { headers: { 'x-api-key': apiKey } })
      const finJson = await finRes.json()
      console.log('fins/summary response keys:', Object.keys(finJson), 'data length:', finJson.data?.length)
      for (const r of finJson.data || []) {
        const code = r.Code
        if (!finMap[code] || r.DiscDate > finMap[code].DiscDate) {
          finMap[code] = r
        }
      }
      paginationKey = finJson.pagination_key
      page++
    } while (paginationKey && page < 20)

    const priceMap: Record<string, number> = {}
    const chunkSize = 50
    for (let i = 0; i < primeCodes.length; i += chunkSize) {
      const chunk = primeCodes.slice(i, i + chunkSize)
      await Promise.all(
        chunk.map(async (code: string) => {
          try {
            const res = await fetch(
              `https://api.jquants.com/v2/equities/bars/daily?code=${code}&date=${dateStr}`,
              { headers: { 'x-api-key': apiKey } }
            )
            const json = await res.json()
            const price = json.data?.[0]?.C
            if (price) priceMap[code] = price
          } catch (_) {}
        })
      )
    }

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
