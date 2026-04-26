import { NextRequest, NextResponse } from 'next/server'

const CODE_MAP: Record<string, { name: string; code: string }> = {
  "228A.T": { name: "opro", code: "228A0" },
  "4397.T": { name: "TeamSpirit", code: "43970" },
  "4374.T": { name: "ROBOT PAYMENT", code: "43740" },
  "431A.T": { name: "Ysona", code: "431A0" },
  "4443.T": { name: "Sansan", code: "44430" },
  "4478.T": { name: "freee", code: "44780" },
  "3994.T": { name: "MoneyForward", code: "39940" },
  "4776.T": { name: "Cybozu", code: "47760" },
  "4058.T": { name: "Toyokumo", code: "40580" },
  "4811.T": { name: "Dream Arts", code: "48110" },
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

    const sales = parseFloat(latestFin.Sales || "0")
    const op = parseFloat(latestFin.OP || "0")
    const odp = parseFloat(latestFin.OdP || "0")
    const np = parseFloat(latestFin.NP || "0")
    const eps = parseFloat(latestFin.EPS || "0")
    const ta = parseFloat(latestFin.TA || "0")
    const eq = parseFloat(latestFin.Eq || "0")
    const div = parseFloat(latestFin.DivAnn || latestFin.FDivAnn || "0")
    const per = eps > 0 ? parseFloat((price / eps).toFixed(1)) : 0
    const shares = eps > 0 && np > 0 ? Math.round(np / eps) : 0
    const marketCap = shares > 0 ? Math.round(price * shares) : 0

    return NextResponse.json({
      ticker, name: meta.name, price,
      change: parseFloat((latest?.C - prev?.C).toFixed(0)),
      changePct: parseFloat(((latest?.C - prev?.C) / prev?.C * 100).toFixed(2)),
      open: latest?.O, high: latest?.H, low: latest?.L, volume: latest?.Vo,
      high52, low52, waterLevel, history,
      sales, op, odp, np, eps, ta, eq, div, per, marketCap,
      finPeriod: latestFin.CurPerType || "",
      finDate: latestFin.DiscDate || "",
      source: "jquants",
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
