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
  const idRes = await fetch(`https://api.jquants.com/v1/token/auth_refresh?refreshtoken=${refreshToken}`, { method: 'POST' })
  const { idToken } = await idRes.json()
  cachedToken = { value: idToken, expiry: Date.now() + 60 * 60 * 1000 }
  return idToken
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const section = searchParams.get('section') || 'TokyoNagoya'
  const from = new Date()
  from.setDate(from.getDate() - 182)
  const fromStr = from.toISOString().split('T')[0].replace(/-/g, '')

  try {
    const apiKey = await getApiKey()
    const res = await fetch(
      `https://api.jquants.com/v2/equities/investor-types?from=${fromStr}`,
      { headers: { 'x-api-key': apiKey } }
    )
    const json = await res.json()
    const all: any[] = json.data || []

    const data = all
      .filter((r) => r.Section === section)
      .sort((a, b) => a.PubDate.localeCompare(b.PubDate))
      .slice(-26)
      .map((r) => ({
        pubDate:     r.PubDate,
        stDate:      r.StDate,
        enDate:      r.EnDate,
        // 差引
        frgnBal:     r.FrgnBal,
        indBal:      r.IndBal,
        invTrBal:    r.InvTrBal,
        trstBnkBal:  r.TrstBnkBal,
        busCoBal:    r.BusCoBal,
        insCoBal:    r.InsCoBal,
        // 買い
        frgnBuy:     r.FrgnBuy,
        indBuy:      r.IndBuy,
        invTrBuy:    r.InvTrBuy,
        trstBnkBuy:  r.TrstBnkBuy,
        busCoBuy:    r.BusCoBuy,
        insCoBuy:    r.InsCoBuy,
        // 売り（負値で返して棒グラフを下向きに）
        frgnSell:    -(r.FrgnSell ?? 0),
        indSell:     -(r.IndSell ?? 0),
        invTrSell:   -(r.InvTrSell ?? 0),
        trstBnkSell: -(r.TrstBnkSell ?? 0),
        busCoSell:   -(r.BusCoSell ?? 0),
        insCoSell:   -(r.InsCoSell ?? 0),
      }))

    return NextResponse.json({ data, section })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}