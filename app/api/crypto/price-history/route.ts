import { NextResponse } from 'next/server'
import { calculateRSISeries, DEFAULT_CRYPTO_SETTINGS } from '@/lib/crypto-bitflyer'
import { fetchMarketChart, productToCoinId } from '@/lib/coingecko'
import { getCandles, getCryptoSettings } from '@/lib/crypto-signal-store'

export type PricePeriod = '24h' | '7d' | '30d' | '1y'

const PERIOD_DAYS: Record<Exclude<PricePeriod, '24h'>, number> = {
  '7d': 7,
  '30d': 30,
  '1y': 365,
}

function formatLabel(unixSec: number, period: PricePeriod): string {
  const opts: Intl.DateTimeFormatOptions =
    period === '24h'
      ? { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' }
  return new Date(unixSec * 1000).toLocaleString('ja-JP', opts)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const productCode = searchParams.get('product_code')?.trim() || 'BTC_JPY'
  const period = (searchParams.get('period') || '24h') as PricePeriod

  if (!['24h', '7d', '30d', '1y'].includes(period)) {
    return NextResponse.json({ error: 'Invalid period' }, { status: 400 })
  }

  const settings = await getCryptoSettings()
  if (!settings.productCodes.includes(productCode)) {
    return NextResponse.json({ error: `product_code not configured: ${productCode}` }, { status: 400 })
  }

  if (period === '24h') {
    let limit = parseInt(searchParams.get('limit') || '100', 10)
    if (Number.isNaN(limit) || limit < 1) limit = 100
    if (limit > 200) limit = 200

    const candles = await getCandles(productCode)
    const slice = candles.slice(-limit)
    const rsiSeries = calculateRSISeries(slice, settings.rsiPeriod || DEFAULT_CRYPTO_SETTINGS.rsiPeriod)

    return NextResponse.json({
      productCode,
      period,
      source: 'bitflyer',
      points: slice.map((c, i) => ({
        time: Math.floor(new Date(c.time).getTime() / 1000),
        label: formatLabel(Math.floor(new Date(c.time).getTime() / 1000), period),
        price: c.close,
        volume: Math.round(c.volume * 1e8) / 1e8,
        rsi: rsiSeries[i],
      })),
    })
  }

  try {
    const coinId = productToCoinId(productCode)
    const days = PERIOD_DAYS[period]
    const raw = await fetchMarketChart(coinId, days, 'jpy')

    // 365日は CoinGecko が日次になるためそのまま使用
    const points = raw.map((p) => ({
      time: p.time,
      label: formatLabel(p.time, period),
      price: Math.round(p.price),
    }))

    return NextResponse.json({
      productCode,
      period,
      source: 'coingecko',
      granularity: days > 90 ? 'daily' : 'auto',
      points,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
