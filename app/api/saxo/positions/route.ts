import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

export async function GET() {
  try {
    const raw = await redis.get('saxo:token')
    if (!raw) return NextResponse.json({ error: 'not_connected' }, { status: 401 })

    const tokenData: any = typeof raw === 'string' ? JSON.parse(raw) : raw

    const accountRes = await fetch(
      'https://gateway.saxobank.com/openapi/port/v1/accounts/me',
      { headers: { Authorization: `Bearer ${tokenData.accessToken}` } }
    )
    const accountJson = await accountRes.json()
    const account = accountJson.Data?.[0]
    if (!account) return NextResponse.json({ error: 'no_account' }, { status: 400 })

    const posRes = await fetch(
      `https://gateway.saxobank.com/openapi/port/v1/positions/me?AccountKey=${account.AccountKey}&ClientKey=${account.ClientKey}`,
      { headers: { Authorization: `Bearer ${tokenData.accessToken}` } }
    )
    const posJson = await posRes.json()

    return NextResponse.json(posJson)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
