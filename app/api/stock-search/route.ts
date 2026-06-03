import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') ?? ''

  const apiKey = process.env.JQUANTS_API_KEY
  if (!apiKey) return NextResponse.json({ results: [] })

  const res = await fetch('https://api.jquants.com/v2/listed/info', {
    headers: { 'x-api-key': apiKey },
  })
  if (!res.ok) return NextResponse.json({ results: [] })

  const data = await res.json()
  console.log('listed/info keys:', Object.keys(data))
  const infos: Array<{ Code: string; CompanyName: string; CompanyNameEnglish: string; MarketCodeName: string }> =
    data.info ?? data.data ?? data.items ?? []

  const q4 = q.replace(/0$/, '')
  const filtered = infos
    .filter(
      (s) =>
        s.Code.startsWith(q) ||
        s.Code.startsWith(q4) ||
        s.CompanyName.includes(q) ||
        (s.CompanyNameEnglish?.toLowerCase() ?? '').includes(q.toLowerCase())
    )
    .slice(0, 20)
    .map((s) => ({ code: s.Code, name: s.CompanyName, market: s.MarketCodeName }))

  return NextResponse.json({ results: filtered })
}
