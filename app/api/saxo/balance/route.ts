import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

async function refreshToken(refreshToken: string) {
  const res = await fetch(process.env.SAXO_TOKEN_ENDPOINT!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.SAXO_APP_KEY!,
      client_secret: process.env.SAXO_APP_SECRET!,
    }),
  })
  return res.json()
}

export async function GET() {
  try {
    const raw = await redis.get('saxo:token')
    if (!raw) {
      return NextResponse.json({ error: 'not_connected' }, { status: 401 })
    }

    let tokenData: any = typeof raw === 'string' ? JSON.parse(raw) : raw

    if (Date.now() > tokenData.expiresAt - 60000) {
      const newToken = await refreshToken(tokenData.refreshToken)
      if (!newToken.access_token) {
        return NextResponse.json({ error: 'token_expired' }, { status: 401 })
      }
      tokenData = {
        accessToken: newToken.access_token,
        refreshToken: newToken.refresh_token ?? tokenData.refreshToken,
        expiresAt: Date.now() + newToken.expires_in * 1000,
      }
      await redis.set('saxo:token', JSON.stringify(tokenData), { ex: 86400 * 7 })
    }

    const accountRes = await fetch('https://gateway.saxobank.com/openapi/port/v1/accounts/me', {
      headers: { Authorization: `Bearer ${tokenData.accessToken}` },
    })
    const accountJson = await accountRes.json()
    const account = accountJson.Data?.[0]

    if (!account) {
      return NextResponse.json({ error: 'no_account' }, { status: 400 })
    }

    const balanceRes = await fetch(
      `https://gateway.saxobank.com/openapi/port/v1/balances?AccountKey=${account.AccountKey}&ClientKey=${account.ClientKey}`,
      { headers: { Authorization: `Bearer ${tokenData.accessToken}` } }
    )
    const balance = await balanceRes.json()

    const fxRes = await fetch(
      'https://gateway.saxobank.com/openapi/trade/v1/infoprices/list?AssetType=FxSpot&Uics=22&FieldGroups=Quote',
      { headers: { Authorization: `Bearer ${tokenData.accessToken}` } }
    )
    const fxJson = await fxRes.json()
    const usdJpy = fxJson.Data?.[0]?.Quote?.Mid ?? 150

    return NextResponse.json({
      accountId: account.AccountId,
      currency: balance.Currency,
      cashBalance: balance.CashBalance,
      totalValue: balance.TotalValue,
      unrealizedPnL: balance.UnrealizedPositionsValue,
      marginUsed: balance.MarginUsedByCurrentPositions ?? 0,
      usdJpy,
      totalValueJpy: Math.round(balance.TotalValue * usdJpy),
      unrealizedPnLJpy: Math.round((balance.UnrealizedPositionsValue ?? 0) * usdJpy),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
