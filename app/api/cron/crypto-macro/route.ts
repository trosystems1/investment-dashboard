import { NextResponse } from 'next/server'
import { fetchBtcDominance, fetchStablecoinSupplyUsd } from '@/lib/coingecko'
import { appendBtcDominance, appendStablecoinSupply } from '@/lib/crypto-macro-store'

export const maxDuration = 30

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-vercel-cron')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && cronHeader !== '1') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const timestamp = new Date().toISOString()
  const results: Record<string, unknown> = { timestamp }

  try {
    const dominance = await fetchBtcDominance()
    await appendBtcDominance(dominance)
    results.btcDominance = dominance
  } catch (e) {
    results.btcDominanceError = e instanceof Error ? e.message : String(e)
  }

  try {
    const stablecoinUsd = await fetchStablecoinSupplyUsd()
    await appendStablecoinSupply(stablecoinUsd)
    results.stablecoinSupplyUsd = stablecoinUsd
  } catch (e) {
    results.stablecoinError = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json(results)
}
