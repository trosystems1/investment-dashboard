// bitFlyer Public API ユーティリティ（個人の調査・学習目的のシグナル検知用。投資助言ではない）

const BITFLYER_BASE = 'https://api.bitflyer.com/v1'

export interface BitflyerExecution {
  id: number
  side: string
  price: number
  size: number
  exec_date: string
}

export interface CryptoCandle {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface CryptoSettings {
  productCodes: string[]
  rsiPeriod: number
  rsiThreshold: number
  volumeLookback: number
  volumeMultiplier: number
  notifyCooldownMinutes: number
  enabled: boolean
}

export const DEFAULT_CRYPTO_SETTINGS: CryptoSettings = {
  productCodes: ['BTC_JPY'],
  rsiPeriod: 14,
  rsiThreshold: 30,
  volumeLookback: 12,
  volumeMultiplier: 3,
  notifyCooldownMinutes: 30,
  enabled: true,
}

export const MAX_CANDLES = 288

export function parseProductCodes(envValue?: string): string[] {
  const fromEnv = (envValue || process.env.CRYPTO_PRODUCT_CODES || 'BTC_JPY')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return fromEnv.length > 0 ? fromEnv : ['BTC_JPY']
}

function bucketStartMs(execDate: string): number {
  const ms = new Date(execDate).getTime()
  const fiveMin = 5 * 60 * 1000
  return Math.floor(ms / fiveMin) * fiveMin
}

export async function fetchExecutions(
  productCode: string,
  options: { after?: number; before?: number; count?: number } = {},
): Promise<BitflyerExecution[]> {
  const params = new URLSearchParams({
    product_code: productCode,
    count: String(options.count ?? 500),
  })
  if (options.after != null) params.set('after', String(options.after))
  if (options.before != null) params.set('before', String(options.before))

  const res = await fetch(`${BITFLYER_BASE}/executions?${params}`)
  if (!res.ok) {
    throw new Error(`bitFlyer executions failed: ${res.status} ${productCode}`)
  }
  return res.json()
}

/** cursor より新しい約定をすべて取得（500件超はページング） */
export async function fetchNewExecutions(
  productCode: string,
  cursor: number | null,
): Promise<BitflyerExecution[]> {
  if (cursor == null) {
    const initial = await fetchExecutions(productCode, { count: 500 })
    return initial.sort((a, b) => a.id - b.id)
  }

  const all: BitflyerExecution[] = []
  let after = cursor
  for (let page = 0; page < 10; page++) {
    const batch = await fetchExecutions(productCode, { after, count: 500 })
    if (batch.length === 0) break
    const sorted = batch.sort((a, b) => a.id - b.id)
    const newer = sorted.filter((e) => e.id > cursor)
    if (newer.length === 0) break
    all.push(...newer)
    after = newer[newer.length - 1].id
    if (batch.length < 500) break
  }
  return all.sort((a, b) => a.id - b.id)
}

export async function fetchTicker(productCode: string): Promise<number | null> {
  const res = await fetch(`${BITFLYER_BASE}/ticker?product_code=${encodeURIComponent(productCode)}`)
  if (!res.ok) return null
  const json = await res.json()
  return typeof json.ltp === 'number' ? json.ltp : null
}

export function executionsToCandles(executions: BitflyerExecution[]): CryptoCandle[] {
  const buckets = new Map<number, CryptoCandle>()
  for (const ex of executions) {
    const start = bucketStartMs(ex.exec_date)
    const existing = buckets.get(start)
    if (!existing) {
      buckets.set(start, {
        time: new Date(start).toISOString(),
        open: ex.price,
        high: ex.price,
        low: ex.price,
        close: ex.price,
        volume: ex.size,
      })
    } else {
      existing.high = Math.max(existing.high, ex.price)
      existing.low = Math.min(existing.low, ex.price)
      existing.close = ex.price
      existing.volume += ex.size
    }
  }
  return [...buckets.values()].sort((a, b) => a.time.localeCompare(b.time))
}

export function mergeCandles(existing: CryptoCandle[], incoming: CryptoCandle[]): CryptoCandle[] {
  const map = new Map(existing.map((c) => [c.time, { ...c }]))
  for (const c of incoming) {
    const prev = map.get(c.time)
    if (!prev) {
      map.set(c.time, { ...c })
    } else {
      prev.high = Math.max(prev.high, c.high)
      prev.low = Math.min(prev.low, c.low)
      prev.close = c.close
      prev.volume += c.volume
    }
  }
  return [...map.values()].sort((a, b) => a.time.localeCompare(b.time)).slice(-MAX_CANDLES)
}

/** Wilder RSI */
export function calculateRSI(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null

  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff >= 0) avgGain += diff
    else avgLoss -= diff
  }
  avgGain /= period
  avgLoss /= period

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return Math.round((100 - 100 / (1 + rs)) * 100) / 100
}

export type SignalEvaluation = {
  rsi: number | null
  volumeRatio: number | null
  price: number | null
  avgVolume: number | null
  latestVolume: number | null
  triggered: boolean
  reason: string
}

export function evaluateSignal(candles: CryptoCandle[], settings: CryptoSettings): SignalEvaluation {
  if (candles.length < settings.volumeLookback + 1) {
    return {
      rsi: null,
      volumeRatio: null,
      price: null,
      avgVolume: null,
      latestVolume: null,
      triggered: false,
      reason: 'insufficient candles',
    }
  }

  const closes = candles.map((c) => c.close)
  const rsi = calculateRSI(closes, settings.rsiPeriod)
  const latest = candles[candles.length - 1]
  const prev = candles.slice(-settings.volumeLookback - 1, -1)
  const avgVolume = prev.reduce((s, c) => s + c.volume, 0) / prev.length
  const volumeRatio = avgVolume > 0 ? latest.volume / avgVolume : null

  const rsiOk = rsi != null && rsi < settings.rsiThreshold
  const volOk = volumeRatio != null && volumeRatio >= settings.volumeMultiplier
  const triggered = rsiOk && volOk

  let reason = 'no signal'
  if (triggered) {
    reason = `RSI ${rsi} < ${settings.rsiThreshold}, volume ${volumeRatio?.toFixed(2)}x avg`
  } else if (!rsiOk && volOk) {
    reason = `volume spike but RSI ${rsi ?? 'n/a'}`
  } else if (rsiOk && !volOk) {
    reason = `RSI low but volume ratio ${volumeRatio?.toFixed(2) ?? 'n/a'}x`
  }

  return {
    rsi,
    volumeRatio: volumeRatio != null ? Math.round(volumeRatio * 100) / 100 : null,
    price: latest.close,
    avgVolume,
    latestVolume: latest.volume,
    triggered,
    reason,
  }
}
