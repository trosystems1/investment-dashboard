import { NextResponse } from 'next/server'

export async function GET() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SAXO_APP_KEY!,
    redirect_uri: 'https://investment-dashboard-ruby.vercel.app/api/saxo/callback',
    state: crypto.randomUUID(),
  })
  const authUrl = `${process.env.SAXO_AUTH_ENDPOINT}?${params}`
  return NextResponse.redirect(authUrl)
}
