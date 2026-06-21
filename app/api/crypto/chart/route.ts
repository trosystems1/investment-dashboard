import { NextResponse } from 'next/server'
import { calculateRSISeries, DEFAULT_CRYPTO_SETTINGS } from '@/lib/crypto-bitflyer'
import { getCandles, getCryptoSettings } from '@/lib/crypto-signal-store'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 200

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const productCode = searchParams.get('product_code')?.trim() || 'BTC_JPY'
  let limit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10)
  if (Number.isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT
  if (limit > MAX_LIMIT) limit = MAX_LIMIT

  const settings = await getCryptoSettings()
  if (!settings.productCodes.includes(productCode)) {
    return NextResponse.json({ error: 'Unknown product_code' }, { status: 400 })
  }

  const candles = await getCandles(productCode)
  const slice = candles.slice(-limit)
  const rsiSeries = calculateRSISeries(slice, settings.rsiPeriod || DEFAULT_CRYPTO_SETTINGS.rsiPeriod)

  return NextResponse.json({
    productCode,
    candles: slice.map((c, i) => ({
      time: Math.floor(new Date(c.time).getTime() / 1000),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: Math.round(c.volume * 1e8) / 1e8,
      rsi: rsiSeries[i],
    })),
  })
}
