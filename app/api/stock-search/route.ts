import { NextResponse } from 'next/server'
export const runtime = 'edge'
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') ?? ''
  const apiKey = process.env.JQUANTS_API_KEY
  if (!apiKey) return NextResponse.json({ results: [] })
  const res = await fetch('https://api.jquants.com/v2/equities/master', {
    headers: { 'x-api-key': apiKey },
  })
  if (!res.ok) return NextResponse.json({ results: [] })
  const data = await res.json()
  const infos: Array<{ Code: string; CoName: string; MktNm: string }> =
    data.info ?? data.master ?? data.data ?? []
  const q4 = q.replace(/0$/, '')
  const filtered = infos
    .filter(
      (s) =>
        s.Code.startsWith(q) ||
        s.Code.startsWith(q4) ||
        s.CoName.includes(q)
    )
    .slice(0, 20)
    .map((s) => ({ code: s.Code, name: s.CoName, market: s.MktNm }))
  return NextResponse.json({ results: filtered })
}
