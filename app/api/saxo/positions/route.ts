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
    const headers = { Authorization: `Bearer ${tokenData.accessToken}` }

    const accountRes = await fetch(
      'https://gateway.saxobank.com/openapi/port/v1/accounts/me',
      { headers }
    )
    const accountJson = await accountRes.json()
    const account = accountJson.Data?.[0]
    if (!account) return NextResponse.json({ error: 'no_account' }, { status: 400 })

    const posRes = await fetch(
      `https://gateway.saxobank.com/openapi/port/v1/positions/me?AccountKey=${account.AccountKey}&ClientKey=${account.ClientKey}&FieldGroups=PositionBase,PositionView`,
      { headers }
    )
    const posJson = await posRes.json()
    const positions = posJson.Data || []

    const uics = [...new Set(positions.map((p: any) => p.PositionBase.Uic))] as number[]

    const instrMap: Record<number, string> = {}
    if (uics.length > 0) {
      const instrRes = await fetch(
        `https://gateway.saxobank.com/openapi/ref/v1/instruments?Uics=${uics.join(',')}&AssetTypes=Stock&FieldGroups=SummaryType`,
        { headers }
      )
      const instrJson = await instrRes.json()
      for (const instr of instrJson.Data || []) {
        instrMap[instr.Identifier] = instr.Description
      }
    }

    const grouped: Record<number, any> = {}
    for (const pos of positions) {
      const uic = pos.PositionBase.Uic
      if (!grouped[uic]) {
        grouped[uic] = {
          uic,
          name: instrMap[uic] || `UIC:${uic}`,
          amount: 0,
          pnl: 0,
          pnlIntraday: 0,
          currency: pos.PositionView.ExposureCurrency,
          assetType: pos.PositionBase.AssetType,
        }
      }
      grouped[uic].amount += pos.PositionBase.Amount
      grouped[uic].pnl += pos.PositionView.ProfitLossOnTrade ?? 0
      grouped[uic].pnlIntraday += pos.PositionView.ProfitLossOnTradeIntraday ?? 0
    }

    const data = Object.values(grouped).sort((a: any, b: any) => b.pnl - a.pnl)

    return NextResponse.json({ data, total: data.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
