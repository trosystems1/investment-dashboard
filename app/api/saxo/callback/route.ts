import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/saxo-connect?error=no_code', req.url))
  }

  try {
    const res = await fetch(process.env.SAXO_TOKEN_ENDPOINT!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'https://investment-dashboard-ruby.vercel.app/api/saxo/callback',
        client_id: process.env.SAXO_APP_KEY!,
        client_secret: process.env.SAXO_APP_SECRET!,
      }),
    })

    const token = await res.json()

    if (!token.access_token) {
      return NextResponse.redirect(new URL('/?saxo=error', req.url))
    }

    await redis.set(
      'saxo:token',
      JSON.stringify({
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: Date.now() + token.expires_in * 1000,
      }),
      { ex: 86400 * 7 }
    )

    return NextResponse.redirect(new URL('/?saxo=connected', req.url))
  } catch {
    return NextResponse.redirect(new URL('/?saxo=error', req.url))
  }
}
