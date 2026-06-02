import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  const apiKey = process.env.JQUANTS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not set' }, { status: 500 })
  }

  const codeWithoutSuffix = code && code.endsWith('0') ? code.slice(0, -1) : code

  const url = codeWithoutSuffix
    ? `https://api.jquants.com/v2/equities/master?code=${encodeURIComponent(codeWithoutSuffix)}`
    : `https://api.jquants.com/v2/equities/master`

  const res = await fetch(url, {
    headers: { 'x-api-key': apiKey },
    next: { revalidate: 86400 },
  })

  if (!res.ok) {
    return NextResponse.json(
      { error: 'Failed to fetch equities master', status: res.status, debug_key_prefix: apiKey.substring(0, 4) },
      { status: res.status },
    )
  }

  const data = await res.json()
  return NextResponse.json({
    data,
    debug_key_prefix: apiKey.substring(0, 4),
  })
}
