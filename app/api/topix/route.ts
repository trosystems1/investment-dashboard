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
  const range = searchParams.get('range') || '3mo'

  const to = new Date()
  const from = new Date()
  if (range === '1mo') from.setMonth(from.getMonth() - 1)
  else if (range === '3mo') from.setMonth(from.getMonth() - 3)
  else if (range === '6mo') from.setMonth(from.getMonth() - 6)
  else from.setFullYear(from.getFullYear() - 1)

  const fromStr = from.toISOString().split('T')[0].replace(/-/g, '')
  const toStr = to.toISOString().split('T')[0].replace(/-/g, '')

  try {
    const apiKey = await getApiKey()
    const res = await fetch(
      `https://api.jquants.com/v2/indices/bars/daily/topix?from=${fromStr}&to=${toStr}`,
      { headers: { 'x-api-key': apiKey } }
    )
    const json = await res.json()
    const data = (json.data || []).map((d: any) => ({
      date: d.Date.slice(5),
      o: d.O,
      h: d.H,
      l: d.L,
      c: d.C,
    }))
    return NextResponse.json({ data, range })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
