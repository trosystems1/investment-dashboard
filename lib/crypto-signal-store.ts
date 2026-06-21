import { Redis } from '@upstash/redis'
import {
  CryptoCandle,
  CryptoSettings,
  DEFAULT_CRYPTO_SETTINGS,
  MAX_CANDLES,
  parseProductCodes,
  SignalEvaluation,
} from './crypto-bitflyer'

const redis = Redis.fromEnv()

const SETTINGS_KEY = 'crypto:settings'

export interface CryptoLastSignal {
  timestamp: string
  productCode: string
  rsi: number | null
  volumeRatio: number | null
  price: number | null
  message: string
}

export interface CryptoHistoryEntry {
  timestamp: string
  rsi: number | null
  volumeRatio: number | null
  price: number | null
  triggered: boolean
  reason: string
  notified?: boolean
}

export interface CryptoLastRun {
  timestamp: string
  results: Array<{
    productCode: string
    newExecutions: number
    candleCount: number
    evaluation: SignalEvaluation
    notified: boolean
  }>
}

export interface CryptoPairStatus {
  productCode: string
  price: number | null
  rsi: number | null
  volumeRatio: number | null
  candleCount: number
  lastSignal: CryptoLastSignal | null
  history: CryptoHistoryEntry[]
  updatedAt: string | null
}

function cursorKey(productCode: string) {
  return `crypto:cursor:${productCode}`
}

function candlesKey(productCode: string) {
  return `crypto:candles:${productCode}:5m`
}

function lastSignalKey(productCode: string) {
  return `crypto:lastSignal:${productCode}`
}

function historyKey(productCode: string) {
  return `crypto:history:${productCode}`
}

export async function getCryptoSettings(): Promise<CryptoSettings> {
  const saved = await redis.get<CryptoSettings>(SETTINGS_KEY)
  const envCodes = parseProductCodes()
  if (!saved) {
    return { ...DEFAULT_CRYPTO_SETTINGS, productCodes: envCodes }
  }
  return {
    ...DEFAULT_CRYPTO_SETTINGS,
    ...saved,
    productCodes: saved.productCodes?.length ? saved.productCodes : envCodes,
  }
}

export async function saveCryptoSettings(settings: CryptoSettings): Promise<void> {
  await redis.set(SETTINGS_KEY, settings)
}

export async function getCursor(productCode: string): Promise<number | null> {
  const v = await redis.get<string>(cursorKey(productCode))
  return v != null ? Number(v) : null
}

export async function setCursor(productCode: string, id: number): Promise<void> {
  await redis.set(cursorKey(productCode), String(id))
}

export async function getCandles(productCode: string): Promise<CryptoCandle[]> {
  return (await redis.get<CryptoCandle[]>(candlesKey(productCode))) ?? []
}

export async function setCandles(productCode: string, candles: CryptoCandle[]): Promise<void> {
  await redis.set(candlesKey(productCode), candles.slice(-MAX_CANDLES))
}

export async function getLastSignal(productCode: string): Promise<CryptoLastSignal | null> {
  return redis.get<CryptoLastSignal>(lastSignalKey(productCode))
}

export async function setLastSignal(record: CryptoLastSignal): Promise<void> {
  await redis.set(lastSignalKey(record.productCode), record)
}

export async function getHistory(productCode: string): Promise<CryptoHistoryEntry[]> {
  return (await redis.get<CryptoHistoryEntry[]>(historyKey(productCode))) ?? []
}

export async function appendHistory(
  productCode: string,
  entry: CryptoHistoryEntry,
): Promise<void> {
  const history = await getHistory(productCode)
  history.unshift(entry)
  await redis.set(historyKey(productCode), history.slice(0, 30))
}

export async function getLastRun(): Promise<CryptoLastRun | null> {
  return redis.get<CryptoLastRun>('crypto:last_run')
}

export async function setLastRun(run: CryptoLastRun): Promise<void> {
  await redis.set('crypto:last_run', run)
}

export async function getPairStatus(productCode: string): Promise<CryptoPairStatus> {
  const [candles, lastSignal, history] = await Promise.all([
    getCandles(productCode),
    getLastSignal(productCode),
    getHistory(productCode),
  ])
  const latest = candles[candles.length - 1]
  const latestHistory = history[0]
  return {
    productCode,
    price: latest?.close ?? latestHistory?.price ?? null,
    rsi: latestHistory?.rsi ?? null,
    volumeRatio: latestHistory?.volumeRatio ?? null,
    candleCount: candles.length,
    lastSignal,
    history,
    updatedAt: latest?.time ?? latestHistory?.timestamp ?? null,
  }
}

export async function getAllPairStatuses(productCodes: string[]): Promise<CryptoPairStatus[]> {
  return Promise.all(productCodes.map((pc) => getPairStatus(pc)))
}

export function isCooldownActive(
  lastSignal: CryptoLastSignal | null,
  cooldownMinutes: number,
): boolean {
  if (!lastSignal) return false
  const elapsed = Date.now() - new Date(lastSignal.timestamp).getTime()
  return elapsed < cooldownMinutes * 60 * 1000
}
