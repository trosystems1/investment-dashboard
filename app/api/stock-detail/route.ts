import { NextRequest, NextResponse } from 'next/server'

let cachedToken: { value: string; expiry: number } | null = null

async function getApiKey(): Promise<string> {
  if (process.env.JQUANTS_API_KEY) return process.env.JQUANTS_API_KEY
  if (cachedToken && cachedToken.expiry > Date.now()) return cachedToken.value

  const email = process.env.JQUANTS_EMAIL!
  const password = process.env.JQUANTS_PASSWORD!

  const refreshRes = await fetch('https://api.jquants.com/v1/token/auth_user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mailaddress: email, password }),
  })
  const { refreshToken } = await refreshRes.json()

  const idRes = await fetch(`https://api.jquants.com/v1/token/auth_refresh?refreshtoken=${refreshToken}`, {
    method: 'POST',
  })
  const { idToken } = await idRes.json()

  cachedToken = { value: idToken, expiry: Date.now() + 60 * 60 * 1000 }
  return idToken
}

const KNOWN: Record<string, { name: string; section: string }> = {
  "228A.T": { name: "opro",          section: "TSEGrowth"   },
  "4397.T": { name: "TeamSpirit",    section: "TSEGrowth"   },
  "4374.T": { name: "ROBOT PAYMENT", section: "TSEGrowth"   },
  "431A.T": { name: "Ysona",         section: "TSEGrowth"   },
  "4443.T": { name: "Sansan",        section: "TSEPrime"    },
  "4478.T": { name: "freee",         section: "TSEGrowth"   },
  "3994.T": { name: "MoneyForward",  section: "TSEPrime"    },
  "4776.T": { name: "Cybozu",        section: "TSEPrime"    },
  "4058.T": { name: "Toyokumo",      section: "TSEPrime"    },
  "4811.T": { name: "Dream Arts",    section: "TSEStandard" },
}

function resolveMeta(ticker: string, nameOverride?: string) {
  const known = KNOWN[ticker]
  return {
    name:    nameOverride || known?.name    || ticker.replace('.T', ''),
    code:    ticker.replace('.T', '') + '0',
    section: known?.section || 'TSEGrowth',
  }
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
  const nameOverride = searchParams.get("name") || undefined
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 })
  const meta = resolveMeta(ticker, nameOverride)

  const { from, to } = getDateRange(range)
  const year1From = new Date()
  year1From.setFullYear(year1From.getFullYear() - 1)
  const year1FromStr = year1From.toISOString().split("T")[0].replace(/-/g, "")
  const invFrom = new Date()
  invFrom.setDate(invFrom.getDate() - 182) // 直近26週間（約半年）
  const invFromStr = invFrom.toISOString().split("T")[0].replace(/-/g, "")

  try {
    const apiKey = await getApiKey()
    const [chartRes, year1Res, finRes, invRes] = await Promise.all([
      fetch(`https://api.jquants.com/v2/equities/bars/daily?code=${meta.code}&from=${from}&to=${to}`, { headers: { "x-api-key": apiKey } }),
      fetch(`https://api.jquants.com/v2/equities/bars/daily?code=${meta.code}&from=${year1FromStr}&to=${to}`, { headers: { "x-api-key": apiKey } }),
      fetch(`https://api.jquants.com/v2/fins/summary?code=${meta.code}`, { headers: { "x-api-key": apiKey } }),
      fetch(`https://api.jquants.com/v2/equities/investor-types?from=${invFromStr}`, { headers: { "x-api-key": apiKey } }),
    ])

    const chartJson = await chartRes.json()
    const year1Json = await year1Res.json()
    const finJson = await finRes.json()
    const invJson = await invRes.json()

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

    // 通期予想（最新開示から取得）
    const isFY = latestFin.CurPerType === "FY"
    const fSales = parseFloat((isFY ? latestFin.NxFSales : latestFin.FSales) || "0")
    const fOp = parseFloat((isFY ? latestFin.NxFOP : latestFin.FOP) || "0")
    const fOdp = parseFloat((isFY ? latestFin.NxFOdP : latestFin.FOdP) || "0")
    const fNp = parseFloat((isFY ? latestFin.NxFNP : latestFin.FNP) || "0")
    const fEps = parseFloat((isFY ? latestFin.NxFEPS : latestFin.FEPS) || "0")
    const fDiv = parseFloat((isFY ? latestFin.NxFDivAnn : latestFin.FDivAnn) || "0")
    const hasForecast = fSales > 0 || fOp > 0 || fNp > 0

    // 同一決算期の四半期実績（1Q/2Q/3Q/FY）を収集
    const curFYSt = latestFin.CurFYSt || latestFin.CurFYEn || ""
    const quarterOrder = ["1Q", "2Q", "3Q", "FY"]
    const seen = new Set<string>()
    const quarterActuals = finData
      .filter((f: any) => {
        const sameFY = !curFYSt || f.CurFYSt === curFYSt || f.CurFYEn === latestFin.CurFYEn
        const isQuarter = quarterOrder.includes(f.CurPerType)
        if (!sameFY || !isQuarter || seen.has(f.CurPerType)) return false
        seen.add(f.CurPerType)
        return true
      })
      .map((f: any) => ({
        period: f.CurPerType,
        sales: parseFloat(f.Sales || "0"),
        op: parseFloat(f.OP || "0"),
        odp: parseFloat(f.OdP || "0"),
        np: parseFloat(f.NP || "0"),
        eps: parseFloat(f.EPS || "0"),
        discDate: f.DiscDate || "",
      }))
      .sort((a: any, b: any) => quarterOrder.indexOf(a.period) - quarterOrder.indexOf(b.period))

    const latestActual = quarterActuals[quarterActuals.length - 1] || {}
    const eps = latestActual.eps || 0
    const np = latestActual.np || 0
    const ta = parseFloat(latestFin.TA || "0")
    const eq = parseFloat(latestFin.Eq || "0")
    const per = eps > 0 ? parseFloat((price / eps).toFixed(1)) : 0
    const fPer = fEps > 0 ? parseFloat((price / fEps).toFixed(1)) : 0
    const shares = eps > 0 && np > 0 ? Math.round(np / eps) : 0
    const marketCap = shares > 0 ? Math.round(price * shares) : 0

    // 投資部門別情報（直近8週・該当市場区分）
    const invAll: any[] = invJson.data || []
    const invBySection = invAll
      .filter((r: any) => r.Section === meta.section)
      .sort((a: any, b: any) => b.PubDate.localeCompare(a.PubDate))
      .slice(0, 26)
      .reverse()
    const investorTypes = invBySection.map((r: any) => ({
      pubDate: r.PubDate,
      stDate: r.StDate,
      enDate: r.EnDate,
      ind: r.IndBal,
      frgn: r.FrgnBal,
      invTr: r.InvTrBal,
      trstBnk: r.TrstBnkBal,
      busCo: r.BusCoBal,
      insCo: r.InsCoBal,
    }))

    return NextResponse.json({
      ticker, name: meta.name, price,
      change: parseFloat((latest?.C - prev?.C).toFixed(0)),
      changePct: parseFloat(((latest?.C - prev?.C) / prev?.C * 100).toFixed(2)),
      open: latest?.O, high: latest?.H, low: latest?.L, volume: latest?.Vo,
      high52, low52, waterLevel, history,
      eps, np, ta, eq, per, marketCap,
      forecast: hasForecast ? { sales: fSales, op: fOp, odp: fOdp, np: fNp, eps: fEps, div: fDiv, per: fPer } : null,
      quarterActuals,
      investorTypes,
      section: meta.section,
      finPeriod: latestFin.CurPerType || "",
      finDate: latestFin.DiscDate || "",
      source: "jquants",
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
