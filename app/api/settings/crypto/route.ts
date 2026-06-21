import { NextResponse } from 'next/server'
import {
  CryptoSettings,
  DEFAULT_CRYPTO_SETTINGS,
  parseProductCodes,
} from '@/lib/crypto-bitflyer'
import {
  getAllPairStatuses,
  getCryptoSettings,
  getLastRun,
  saveCryptoSettings,
} from '@/lib/crypto-signal-store'

export async function GET() {
  const settings = await getCryptoSettings()
  const [statuses, lastRun] = await Promise.all([
    getAllPairStatuses(settings.productCodes),
    getLastRun(),
  ])
  return NextResponse.json({ settings, statuses, lastRun })
}

export async function POST(req: Request) {
  const body = await req.json()
  const current = await getCryptoSettings()

  const productCodesRaw = body.productCodes ?? current.productCodes
  const productCodes = Array.isArray(productCodesRaw)
    ? productCodesRaw.map(String).filter(Boolean)
    : String(productCodesRaw)
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean)

  const settings: CryptoSettings = {
    productCodes: productCodes.length > 0 ? productCodes : parseProductCodes(),
    rsiPeriod: Number(body.rsiPeriod ?? current.rsiPeriod) || DEFAULT_CRYPTO_SETTINGS.rsiPeriod,
    rsiThreshold:
      Number(body.rsiThreshold ?? current.rsiThreshold) || DEFAULT_CRYPTO_SETTINGS.rsiThreshold,
    volumeLookback:
      Number(body.volumeLookback ?? current.volumeLookback) ||
      DEFAULT_CRYPTO_SETTINGS.volumeLookback,
    volumeMultiplier:
      Number(body.volumeMultiplier ?? current.volumeMultiplier) ||
      DEFAULT_CRYPTO_SETTINGS.volumeMultiplier,
    notifyCooldownMinutes:
      Number(body.notifyCooldownMinutes ?? current.notifyCooldownMinutes) ||
      DEFAULT_CRYPTO_SETTINGS.notifyCooldownMinutes,
    enabled: body.enabled !== undefined ? Boolean(body.enabled) : current.enabled,
  }

  await saveCryptoSettings(settings)
  return NextResponse.json({ success: true, settings })
}
