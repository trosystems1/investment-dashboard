import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

const CODE_MAP: Record<string, { name: string; code: string; corporateNumber: string }> = {
  "228A.T": { name: "opro", code: "228A0", corporateNumber: "2010401054559" },
  "4397.T": { name: "TeamSpirit", code: "43970", corporateNumber: "1010001116826" },
  "4374.T": { name: "ROBOT PAYMENT", code: "43740", corporateNumber: "" },
  "431A.T": { name: "Ysona", code: "431A0", corporateNumber: "" },
  "4443.T": { name: "Sansan", code: "44430", corporateNumber: "4010001120965" },
  "4478.T": { name: "freee", code: "44780", corporateNumber: "" },
  "3994.T": { name: "MoneyForward", code: "39940", corporateNumber: "6011101063359" },
  "4776.T": { name: "Cybozu", code: "47760", corporateNumber: "5010001072207" },
  "4058.T": { name: "Toyokumo", code: "40580", corporateNumber: "" },
  "4811.T": { name: "Dream Arts", code: "48110", corporateNumber: "" },
}

function getDateRange(range: string) {
  const to = new Date()
  const from = new Date()
  if (range === "1mo") from.setMonth(from.getMonth() - 1)
  else if (range === "3mo") from.setMonth(from.getMonth() - 3)
  else if (range === "6mo") from.setMonth(from.getMonth() - 6)
  else from.setFullYear(from.getFullYear() - 1)
  return {
    from: from.toISOString().split("T")[0].replace(/-/g, ""),
    to: to.toISOString().split("T")[0].replace(/-/g, ""),
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get("ticker") || ""
  const range = searchParams.get("range") || "3mo"
  const apiKey = process.env.JQUANTS_API_KEY!
  const meta = CODE_MAP[ticker]
  if (!meta) return NextResponse.json({ error: "Unknown ticker" }, { status: 404 })

  const { from, to } = getDateRange(range)
  const year1From = new Date()
  year1From.setFullYear(year1From.getFullYear() - 1)
  const year1FromStr = year1From.toISOString().split("T")[0].replace(/-/g, "")

  try {
    const [chartRes, year1Res, finRes] = await Promise.all([
      fetch(`https://api.jquants.com/v2/equities/bars/daily?code=${meta.code}&from=${from}&to=${to}`, { headers: { "x-api-key": apiKey } }),
      fetch(`https://api.jquants.com/v2/equities/bars/daily?code=${meta.code}&from=${year1FromStr}&to=${to}`, { headers: { "x-api-key": apiKey } }),
      fetch(`https://api.jquants.com/v2/fins/summary?code=${meta.code}`, { headers: { "x-api-key": apiKey } }),
    ])

    const chartJson = await chartRes.json()
    const year1Json = await year1Res.json()
    const finJson = await finRes.json()

    const quotes = chartJson.data || []
    const year1Quotes = year1Json.data || []
    const finData = (finJson.data || []).sort((a: any, b: any) => b.DiscDate.localeCompare(a.DiscDate))
    const latestFin = finData[0] || {}

    const latest = quotes[quotes.length - 1]
    const prev = quotes.length > 1 ? quotes[quotes.length - 2] : latest
    const high52 = year1Quotes.length ? Math.max(...year1Quotes.map((q: any) => q.H)) : latest?.H || 0
    const low52 = year1Quotes.length ? Math.min(...year1Quotes.map((q: any) => q.L)) : latest?.L || 0
    const price = latest?.C || 0
    const waterLevel = high52 > low52 ? Math.round((price - low52) / (high52 - low52) * 100) : 50
    const history = quotes.map((q: any) => ({ date: q.Date.slice(5), value: q.C }))

    const sales = parseFloat(latestFin.FSales || latestFin.Sales || "0")
    const op = parseFloat(latestFin.FOP || latestFin.OP || "0")
    const np = parseFloat(latestFin.FNP || latestFin.NP || "0")
    const eps = parseFloat(latestFin.FEPS || latestFin.EPS || "0")
    const ta = parseFloat(latestFin.TA || "0")
    const eq = parseFloat(latestFin.Eq || "0")
    const per = eps > 0 ? parseFloat((price / eps).toFixed(1)) : 0

    // 社員数データ取得
    let nenkinData = null
    if (meta.corporateNumber && process.env.NENKIN_DATABASE_URL) {
      try {
        const sql = neon(process.env.NENKIN_DATABASE_URL)
        const rows = await sql`
          SELECT nr.insured_count, nr.record_date,
            LAG(nr.insured_count) OVER (ORDER BY nr.record_date) as prev_count
          FROM nenkin_records nr
          JOIN companies c ON c.id = nr.company_id
          WHERE c.corporate_number = ${meta.corporateNumber}
          ORDER BY nr.record_date DESC
          LIMIT 6
        `
        if (rows.length > 0) {
          const latest = rows[0]
          const prev = rows[1]
          nenkinData = {
            insuredCount: latest.insured_count,
            recordDate: latest.record_date,
            prevCount: prev?.insured_count || null,
            changeCount: prev ? latest.insured_count - prev.insured_count : null,
            changePct: prev ? parseFloat(((latest.insured_count - prev.insured_count) / prev.insured_count * 100).toFixed(1)) : null,
            history: rows.reverse().map((r: any) => ({
              date: new Date(r.record_date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short' }),
              count: r.insured_count,
            }))
          }
        }
      } catch (e) {
        console.error('Nenkin DB error:', e)
      }
    }

    return NextResponse.json({
      ticker, name: meta.name, price,
      change: parseFloat((latest?.C - prev?.C).toFixed(0)),
      changePct: parseFloat(((latest?.C - prev?.C) / prev?.C * 100).toFixed(2)),
      open: latest?.O, high: latest?.H, low: latest?.L, volume: latest?.Vo,
      high52, low52, waterLevel, history,
      sales, op, np, eps, ta, eq, per,
      finPeriod: latestFin.CurPerType || "",
      finDate: latestFin.DiscDate || "",
      nenkin: nenkinData,
      source: "jquants",
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
