import { Redis } from '@upstash/redis'

type HistoryEntry = { date: string; signals: string[]; checkedAt: string }

export type SignalLastRun = {
  timestamp: string
  signalCount: number
  signals: string[]
  tickerCount?: number
  ruleCount?: number
}

export function dateJST(d: Date = new Date()): string {
  return d.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\//g, '-')
}

export async function buildSignalsFromHistory(
  redis: Redis,
  tickers: string[],
  runDate: string,
): Promise<string[]> {
  const signals: string[] = []
  for (const ticker of tickers) {
    const [history, companyName] = await Promise.all([
      redis.get<HistoryEntry[]>(`signal:history:${ticker}`),
      redis.get<string>(`company:${ticker}`),
    ])
    const entry = history?.find(h => h.date === runDate)
    if (entry && entry.signals.length > 0) {
      signals.push(`📈 ${companyName ?? ticker}（${ticker}）\n${entry.signals.join('\n')}`)
    }
  }
  return signals
}

export async function reconcileLastRun(
  redis: Redis,
  lastRun: SignalLastRun | null,
  tickers: string[],
): Promise<SignalLastRun | null> {
  if (!lastRun || tickers.length === 0) return lastRun
  const runDate = dateJST(new Date(lastRun.timestamp))
  const signals = await buildSignalsFromHistory(redis, tickers, runDate)
  return { ...lastRun, signalCount: signals.length, signals }
}
