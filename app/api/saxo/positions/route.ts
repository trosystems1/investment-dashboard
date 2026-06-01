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
        `https://gateway.saxobank.com/openapi/ref/v1/instruments?Uics=${uics.join(',')}&AssetTypes=Stock`,
        { headers }
      )
      const instrJson = await instrRes.json()

      console.log('instruments response:', JSON.stringify(instrJson).slice(0, 500))

      for (const instr of instrJson.Data || []) {
        instrMap[instr.Identifier] =
          instr.Description || instr.Symbol || instr.Name || `UIC:${instr.Identifier}`
      }
    }

    const grouped: Record<number, any> = {}
    for (const pos of positions) {
      const uic = pos.PositionBase.Uic
      const amount = pos.PositionBase.Amount
      const openPrice = pos.PositionBase.OpenPrice
      const pnl = pos.PositionView.ProfitLossOnTrade ?? 0
      const pnlIntraday = pos.PositionView.ProfitLossOnTradeIntraday ?? 0
      const convRate = pos.PositionView.ConversionRateOpen ?? 1

      if (!grouped[uic]) {
        grouped[uic] = {
          uic,
          name: instrMap[uic] || `UIC:${uic}`,
          amount: 0,
          totalCost: 0,
          pnl: 0,
          pnlIntraday: 0,
          pnlJpy: 0,
          currency: pos.PositionView.ExposureCurrency,
          assetType: pos.PositionBase.AssetType,
          convRate,
        }
      }
      grouped[uic].amount += amount
      grouped[uic].totalCost += openPrice * amount
      grouped[uic].pnl += pnl
      grouped[uic].pnlIntraday += pnlIntraday
      grouped[uic].pnlJpy += pnl * convRate
    }

    const data = Object.values(grouped)
      .map((pos: any) => ({
        ...pos,
        avgOpenPrice: pos.amount !== 0 ? pos.totalCost / pos.amount : 0,
        pnlPct: pos.totalCost > 0 ? (pos.pnl / pos.totalCost) * 100 : 0,
        totalValueJpy: (pos.totalCost + pos.pnl) * pos.convRate,
      }))
      .sort((a: any, b: any) => b.pnl - a.pnl)

    return NextResponse.json({ data, total: data.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
