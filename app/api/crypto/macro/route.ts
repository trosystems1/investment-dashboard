import { NextResponse } from 'next/server'
import { fetchFearGreed, fetchMarketChart, productToCoinId } from '@/lib/coingecko'
import { getMacroSnapshot } from '@/lib/crypto-macro-store'
import { fetchYahooDaily } from '@/lib/yahoo-finance'

function alignByDate(
  btc: { time: number; price: number }[],
  dxy: { time: number; close: number }[],
) {
  const dxyMap = new Map(
    dxy.map((d) => [
      new Date(d.time * 1000).toISOString().slice(0, 10),
      d.close,
    ]),
  )

  return btc
    .map((b) => {
      const key = new Date(b.time * 1000).toISOString().slice(0, 10)
      const dxyVal = dxyMap.get(key)
      if (dxyVal == null) return null
      return {
        date: new Date(b.time * 1000).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
        time: b.time,
        btc: Math.round(b.price),
        dxy: Math.round(dxyVal * 100) / 100,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r != null)
}

export async function GET() {
  const [macro, fearGreedResult, dxyResult, btcResult] = await Promise.allSettled([
    getMacroSnapshot(),
    fetchFearGreed(90),
    fetchYahooDaily('DX-Y.NYB', '1y'),
    fetchMarketChart(productToCoinId('BTC_JPY'), 365, 'jpy'),
  ])

  const errors: string[] = []

  const macroData = macro.status === 'fulfilled' ? macro.value : { btcDominance: [], stablecoinSupply: [], latestDominance: null, latestStablecoin: null }
  if (macro.status === 'rejected') errors.push('macro redis')

  let fearGreed: Awaited<ReturnType<typeof fetchFearGreed>> = []
  let currentFng: Awaited<ReturnType<typeof fetchFearGreed>>[number] | null = null
  if (fearGreedResult.status === 'fulfilled') {
    currentFng = fearGreedResult.value[0] ?? null
    fearGreed = [...fearGreedResult.value].reverse()
  } else {
    errors.push('fear & greed')
  }

  let dxyBtc: ReturnType<typeof alignByDate> = []
  if (dxyResult.status === 'fulfilled' && btcResult.status === 'fulfilled') {
    // BTC を日次に間引き
    const btcDaily = new Map<string, { time: number; price: number }>()
    for (const p of btcResult.value) {
      const key = new Date(p.time * 1000).toISOString().slice(0, 10)
      btcDaily.set(key, p)
    }
    const btcArr = [...btcDaily.values()].sort((a, b) => a.time - b.time)
    dxyBtc = alignByDate(btcArr, dxyResult.value)
  } else {
    errors.push('dxy/btc')
  }

  return NextResponse.json({
    btcDominance: macroData.btcDominance,
    stablecoinSupply: macroData.stablecoinSupply,
    latestDominance: macroData.latestDominance,
    latestStablecoin: macroData.latestStablecoin,
    fearGreed,
    currentFng,
    dxyBtc,
    errors: errors.length > 0 ? errors : undefined,
  })
}
