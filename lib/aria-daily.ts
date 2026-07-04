import { DailyQuote, fetchYahooDaily } from './yahoo-finance'

export const INDEX_SYMBOLS = {
  sp500: '^GSPC',
  nasdaq: '^IXIC',
  nikkei: '^N225',
} as const

/** 米国主要セクターETF（GICSセクターの代理指標）。取得失敗時はスキップする */
export const SECTOR_ETF_SYMBOLS: Record<string, string> = {
  Technology: 'XLK',
  Financials: 'XLF',
  Energy: 'XLE',
  Healthcare: 'XLV',
  ConsumerDiscretionary: 'XLY',
  ConsumerStaples: 'XLP',
  Industrials: 'XLI',
  Materials: 'XLB',
  Utilities: 'XLU',
  RealEstate: 'XLRE',
  Communication: 'XLC',
}

export const SECTOR_LABELS_JA: Record<string, string> = {
  Technology: 'テクノロジー',
  Financials: '金融',
  Energy: 'エネルギー',
  Healthcare: 'ヘルスケア',
  ConsumerDiscretionary: '一般消費財',
  ConsumerStaples: '生活必需品',
  Industrials: '資本財',
  Materials: '素材',
  Utilities: '公益事業',
  RealEstate: '不動産',
  Communication: '通信サービス',
}

export function dateJST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

function pctChange(from: number, to: number): number | null {
  if (!from) return null
  return Math.round(((to - from) / from) * 10000) / 100
}

export type PeriodChange = {
  symbol: string
  latestClose: number
  changePct1m: number | null
  changePct3m: number | null
}

/** 直近終値から約1ヶ月前(21営業日)・約3ヶ月前(63営業日)比の騰落率を算出 */
export async function fetchPeriodChange(symbol: string): Promise<PeriodChange | null> {
  const quotes = await fetchYahooDaily(symbol, '6mo')
  if (quotes.length < 2) return null
  const latest = quotes[quotes.length - 1]

  const idx1m = quotes.length - 1 - 21
  const idx3m = quotes.length - 1 - 63

  return {
    symbol,
    latestClose: latest.close,
    changePct1m: idx1m >= 0 ? pctChange(quotes[idx1m].close, latest.close) : null,
    changePct3m: idx3m >= 0 ? pctChange(quotes[idx3m].close, latest.close) : null,
  }
}

export type SectorChange = {
  key: string
  labelJa: string
  symbol: string
  changePct1m: number | null
}

/** セクターETFの1ヶ月騰落率を取得（一部失敗しても続行） */
export async function fetchSectorChanges(): Promise<SectorChange[]> {
  const entries = Object.entries(SECTOR_ETF_SYMBOLS)
  const results = await Promise.all(
    entries.map(async ([key, symbol]) => {
      try {
        const change = await fetchPeriodChange(symbol)
        if (!change) return null
        return { key, labelJa: SECTOR_LABELS_JA[key] ?? key, symbol, changePct1m: change.changePct1m }
      } catch {
        return null
      }
    }),
  )
  return results.filter((r): r is SectorChange => r != null && r.changePct1m != null)
}

type DailyChange = { time: number; date: string; changePct: number }

function toDailyChanges(quotes: DailyQuote[]): DailyChange[] {
  const changes: DailyChange[] = []
  for (let i = 1; i < quotes.length; i++) {
    const prev = quotes[i - 1]
    const cur = quotes[i]
    const pct = pctChange(prev.close, cur.close)
    if (pct != null) changes.push({ time: cur.time, date: cur.date, changePct: pct })
  }
  return changes
}

function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  const n = xs.length
  if (n < 2 || ys.length !== n) return null
  const meanX = xs.reduce((s, v) => s + v, 0) / n
  const meanY = ys.reduce((s, v) => s + v, 0) / n
  let cov = 0
  let varX = 0
  let varY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX
    const dy = ys[i] - meanY
    cov += dx * dy
    varX += dx * dx
    varY += dy * dy
  }
  if (varX === 0 || varY === 0) return null
  return Math.round((cov / Math.sqrt(varX * varY)) * 100) / 100
}

export type CoMovementPair = {
  usDate: string
  usChangePct: number
  nikkeiDate: string
  nikkeiChangePct: number
}

export type CoMovementResult = {
  correlation: number | null
  sameDirectionCount: number
  totalPairs: number
  latestPair: CoMovementPair | null
}

/**
 * 米国市場の当日の値動きと、翌営業日の日経225の反応を突き合わせる。
 * 厳密な因果関係を主張するものではなく、単純な相関係数と同方向判定のみを行う。
 */
export async function fetchUsJapanCoMovement(lookbackDays = 20): Promise<CoMovementResult> {
  const [sp500Quotes, nikkeiQuotes] = await Promise.all([
    fetchYahooDaily(INDEX_SYMBOLS.sp500, '3mo'),
    fetchYahooDaily(INDEX_SYMBOLS.nikkei, '3mo'),
  ])

  const usChanges = toDailyChanges(sp500Quotes)
  const nikkeiChanges = toDailyChanges(nikkeiQuotes)

  const pairs: CoMovementPair[] = []
  for (const us of usChanges) {
    const next = nikkeiChanges.find((n) => n.time > us.time)
    if (next) {
      pairs.push({
        usDate: us.date,
        usChangePct: us.changePct,
        nikkeiDate: next.date,
        nikkeiChangePct: next.changePct,
      })
    }
  }

  const recent = pairs.slice(-lookbackDays)
  const correlation = pearsonCorrelation(
    recent.map((p) => p.usChangePct),
    recent.map((p) => p.nikkeiChangePct),
  )
  const sameDirectionCount = recent.filter((p) => Math.sign(p.usChangePct) === Math.sign(p.nikkeiChangePct)).length

  return {
    correlation,
    sameDirectionCount,
    totalPairs: recent.length,
    latestPair: pairs.at(-1) ?? null,
  }
}

export type AriaDailyData = {
  dateJst: string
  sp500: PeriodChange | null
  nasdaq: PeriodChange | null
  sectors: SectorChange[]
  coMovement: CoMovementResult
  errors: string[]
}

export async function fetchAriaDailyData(): Promise<AriaDailyData> {
  const errors: string[] = []

  const [sp500, nasdaq, sectors, coMovement] = await Promise.all([
    fetchPeriodChange(INDEX_SYMBOLS.sp500).catch((e) => {
      errors.push(`sp500: ${e instanceof Error ? e.message : String(e)}`)
      return null
    }),
    fetchPeriodChange(INDEX_SYMBOLS.nasdaq).catch((e) => {
      errors.push(`nasdaq: ${e instanceof Error ? e.message : String(e)}`)
      return null
    }),
    fetchSectorChanges().catch((e) => {
      errors.push(`sectors: ${e instanceof Error ? e.message : String(e)}`)
      return []
    }),
    fetchUsJapanCoMovement().catch((e) => {
      errors.push(`coMovement: ${e instanceof Error ? e.message : String(e)}`)
      return { correlation: null, sameDirectionCount: 0, totalPairs: 0, latestPair: null }
    }),
  ])

  return { dateJst: dateJST(), sp500, nasdaq, sectors, coMovement, errors }
}

function formatSignedPercent(value: number): string {
  return `${value >= 0 ? 'プラス' : 'マイナス'}${Math.abs(value)}パーセント`
}

/**
 * 騰落率の符号を判定する。`Math.sign` は丸め後の値が `0`/`-0` になるケースを
 * 考慮していないため、方向ラベルと順行/逆行判定を同じ基準で揃えるために使う。
 */
function directionSign(pct: number): -1 | 0 | 1 {
  if (pct > 0) return 1
  if (pct < 0) return -1
  return 0
}

function directionLabel(pct: number): '上昇' | '下落' | '横ばい' {
  const sign = directionSign(pct)
  if (sign > 0) return '上昇'
  if (sign < 0) return '下落'
  return '横ばい'
}

/** 人間可読な日本語の短文配列に変換する（ARIA動画のナレーション素材向け） */
export function buildFacts(data: AriaDailyData): string[] {
  const facts: string[] = []

  if (data.sp500?.changePct1m != null) {
    facts.push(`S&P500は1ヶ月前比${formatSignedPercent(data.sp500.changePct1m)}`)
  }
  if (data.sp500?.changePct3m != null) {
    facts.push(`S&P500は3ヶ月前比${formatSignedPercent(data.sp500.changePct3m)}`)
  }
  if (data.nasdaq?.changePct1m != null) {
    facts.push(`NASDAQは1ヶ月前比${formatSignedPercent(data.nasdaq.changePct1m)}`)
  }
  if (data.nasdaq?.changePct3m != null) {
    facts.push(`NASDAQは3ヶ月前比${formatSignedPercent(data.nasdaq.changePct3m)}`)
  }

  if (data.sectors.length > 0) {
    const sorted = [...data.sectors].sort((a, b) => (b.changePct1m ?? 0) - (a.changePct1m ?? 0))
    const best = sorted[0]
    const worst = sorted[sorted.length - 1]
    if (best && best.changePct1m != null) {
      facts.push(`セクター別では${best.labelJa}が1ヶ月で最も上昇（${formatSignedPercent(best.changePct1m)}）`)
    }
    if (worst && worst.changePct1m != null && worst.key !== best?.key) {
      facts.push(`${worst.labelJa}が1ヶ月で最も下落（${formatSignedPercent(worst.changePct1m)}）`)
    }
  }

  const { latestPair, correlation, sameDirectionCount, totalPairs } = data.coMovement
  if (latestPair) {
    const usSign = directionSign(latestPair.usChangePct)
    const nikkeiSign = directionSign(latestPair.nikkeiChangePct)
    const usDirection = directionLabel(latestPair.usChangePct)
    if (usSign === 0 || nikkeiSign === 0) {
      // どちらかがほぼ変わらず(横ばい)の場合、「順行/逆行」と断定すると
      // 矛盾した表現(例: 「上昇」なのに「逆行」)になり得るため中立的に記述する
      const nikkeiDirection = directionLabel(latestPair.nikkeiChangePct)
      facts.push(
        `今回の米国株は${usDirection}(${formatSignedPercent(latestPair.usChangePct)})、翌営業日の日経225は${nikkeiDirection}(${formatSignedPercent(latestPair.nikkeiChangePct)})でした`,
      )
    } else {
      const sameDirection = usSign === nikkeiSign
      const verb = sameDirection ? '波及' : '逆行'
      facts.push(
        `今回の米国株${usDirection}は翌営業日の日経225にも${verb}(${formatSignedPercent(latestPair.nikkeiChangePct)})`,
      )
    }
  }
  if (correlation != null && totalPairs > 0) {
    facts.push(
      `直近${totalPairs}営業日では、米国株の翌営業日の日経225への連動係数(相関)は${correlation}、同方向に動いた日は${sameDirectionCount}/${totalPairs}回でした`,
    )
  }
  facts.push('※上記は単純な相関・同方向判定であり、統計的な因果関係を示すものではありません')

  return facts
}

export type AriaDailyRecord = {
  date: string
  facts: string[]
  sp500_change_pct_1m: number | null
  sp500_change_pct_3m: number | null
  nasdaq_change_pct_1m: number | null
  nasdaq_change_pct_3m: number | null
  sector_changes: SectorChange[]
  comovement: CoMovementResult
}

export function toAriaDailyRecord(data: AriaDailyData, facts: string[]): AriaDailyRecord {
  return {
    date: data.dateJst,
    facts,
    sp500_change_pct_1m: data.sp500?.changePct1m ?? null,
    sp500_change_pct_3m: data.sp500?.changePct3m ?? null,
    nasdaq_change_pct_1m: data.nasdaq?.changePct1m ?? null,
    nasdaq_change_pct_3m: data.nasdaq?.changePct3m ?? null,
    sector_changes: data.sectors,
    comovement: data.coMovement,
  }
}

function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return { url, key }
}

export async function saveAriaDailyInsight(record: AriaDailyRecord): Promise<void> {
  const cfg = supabaseConfig()
  if (!cfg) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です')
  }
  const { url, key } = cfg

  const existing = await fetch(`${url}/rest/v1/aria_daily_insights?date=eq.${record.date}&select=id`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  const rows = await existing.json()
  const hasRow = Array.isArray(rows) && rows.length > 0

  const endpoint = hasRow
    ? `${url}/rest/v1/aria_daily_insights?date=eq.${record.date}`
    : `${url}/rest/v1/aria_daily_insights`

  const res = await fetch(endpoint, {
    method: hasRow ? 'PATCH' : 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(record),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase save failed: ${res.status} ${err.slice(0, 300)}`)
  }
}

export type AriaDailyRow = AriaDailyRecord & {
  id: number
  created_at: string
}

export async function listAriaDailyInsights(limit = 30): Promise<AriaDailyRow[]> {
  const cfg = supabaseConfig()
  if (!cfg) return []
  const { url, key } = cfg

  const res = await fetch(`${url}/rest/v1/aria_daily_insights?select=*&order=date.desc&limit=${limit}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    next: { revalidate: 300 },
  })
  if (!res.ok) return []
  return res.json()
}
