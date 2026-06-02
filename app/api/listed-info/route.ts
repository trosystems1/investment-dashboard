import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  const apiKey = process.env.JQUANTS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'JQUANTS_API_KEY is not configured' }, { status: 500 })
  }

  const url = code
    ? `https://api.jquants.com/v2/listed/info?code=${encodeURIComponent(code)}`
    : `https://api.jquants.com/v2/listed/info`

  const res = await fetch(url, {
    headers: { 'x-api-key': apiKey },
    next: { revalidate: 86400 },
  })

  if (!res.ok) {
    return NextResponse.json(
      { error: 'Failed to fetch listed info', status: res.status },
      { status: res.status },
    )
  }

  const data = await res.json()
  return NextResponse.json(data)
}
