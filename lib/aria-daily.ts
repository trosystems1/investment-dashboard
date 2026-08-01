import { DailyQuote, fetchYahooDaily, fetchYahooQuoteChange, YahooQuoteSnapshot } from './yahoo-finance'

export const INDEX_SYMBOLS = {
  sp500:  '^GSPC',
  nasdaq: '^IXIC',
  nikkei: '^N225',
} as const

export const SECTOR_ETF_SYMBOLS: Record<string, string> = {
  Technology:            'XLK',
  Financials:            'XLF',
  Energy:                'XLE',
  Healthcare:            'XLV',
  ConsumerDiscretionary: 'XLY',
  ConsumerStaples:       'XLP',
  Industrials:           'XLI',
  Materials:             'XLB',
  Utilities:             'XLU',
  RealEstate:            'XLRE',
  Communication:         'XLC',
}

export const SECTOR_LABELS_JA: Record<string, string> = {
  Technology:            'テクノロジー',
  Financials:            '金融',
  Energy:                'エネルギー',
  Healthcare:            'ヘルスケア',
  ConsumerDiscretionary: '一般消費財',
  ConsumerStaples:       '生活必需品',
  Industrials:           '資本財',
  Materials:             '素材',
  Utilities:             '公益事業',
  RealEstate:            '不動産',
  Communication:         '通信サービス',
}

// ── トップ50銘柄（時価総額加重、VIX・ドル円含む）────────────────────────
export const TOP50_SYMBOLS: readonly string[] = [
  'NVDA', 'MSFT', 'AAPL', 'AVGO', 'ORCL', 'CRM',  'AMD',  'ADBE', 'NOW',  'QCOM',
  'TXN',  'INTC', 'IBM',  'CSCO', 'MU',   'AMZN', 'TSLA', 'HD',   'MCD',  'NKE',
  'SBUX', 'META', 'GOOGL','NFLX', 'DIS',  'CMCSA','TMUS', 'JPM',  'MA',   'AXP',
  'BAC',  'MS',   'GS',   'UNH',  'LLY',  'JNJ',  'ABBV', 'MRK',  'WMT',  'COST',
  'PG',   'KO',   'PEP',  'CAT',  'GE',   'BA',   'XOM',  'CVX',  'NEE',  'PLD',
] as const

// 注目銘柄（音声で名前を読む）
export const NOTABLE_NAMES: Record<string, string> = {
  NVDA:  'エヌビディア',
  AAPL:  'アップル',
  MSFT:  'マイクロソフト',
  GOOGL: 'グーグル',
  META:  'メタ',
  AMZN:  'アマゾン',
  TSLA:  'テスラ',
  AVGO:  'ブロードコム',
  AMD:   'AMD',
  INTC:  'インテル',
  JPM:   'JPモルガン',
  GS:    'ゴールドマン',
}

export function dateJST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

function pctChange(from: number, to: number): number | null {
  if (!from) return null
  return Math.round(((to - from) / from) * 10000) / 100
}

export type PeriodChange = {
  symbol:       string
  latestClose:  number
  changePct1m:  number | null
  changePct3m:  number | null
}

export async function fetchPeriodChange(symbol: string): Promise<PeriodChange | null> {
  const quotes = await fetchYahooDaily(symbol, '6mo')
  if (quotes.length < 2) return null
  const latest = quotes[quotes.length - 1]
  const idx1m  = quotes.length - 1 - 21
  const idx3m  = quotes.length - 1 - 63
  return {
    symbol,
    latestClose: latest.close,
    changePct1m: idx1m >= 0 ? pctChange(quotes[idx1m].close, latest.close) : null,
    changePct3m: idx3m >= 0 ? pctChange(quotes[idx3m].close, latest.close) : null,
  }
}

export type SectorChange = {
  key:         string
  labelJa:     string
  symbol:      string
  changePct1m: number | null
}

export async function fetchSectorChanges(): Promise<SectorChange[]> {
  const entries = Object.entries(SECTOR_ETF_SYMBOLS)
  const results = await Promise.all(
    entries.map(async ([key, symbol]) => {
      try {
        const change = await fetchPeriodChange(symbol)
        if (!change) return null
        return { key, labelJa: SECTOR_LABELS_JA[key] ?? key, symbol, changePct1m: change.changePct1m }
      } catch { return null }
    }),
  )
  return results.filter((r): r is SectorChange => r != null && r.changePct1m != null)
}

// ── 個別株スナップショット（トップ50、前日比）────────────────────────────
export type StockQuote = {
  symbol:    string
  close:     number
  change:    number
  changePct: number
}

export async function fetchTop50Quotes(): Promise<StockQuote[]> {
  const results = await Promise.allSettled(
    TOP50_SYMBOLS.map(symbol => fetchYahooQuoteChange(symbol))
  )
  return results
    .map((r, i) => {
      if (r.status === 'rejected' || !r.value) return null
      const q = r.value
      return {
        symbol:    TOP50_SYMBOLS[i],
        close:     q.close,
        change:    q.change,
        changePct: q.changePct,
      }
    })
    .filter((q): q is StockQuote => q != null)
}

// ── 決算カレンダー（earningsapi.com → トップ50フィルター）──────────────
export type EarningsEntry = {
  ticker: string
  name:   string
  when:   'before_open' | 'after_close' | 'unknown'
}

const TOP50_SET = new Set<string>(TOP50_SYMBOLS)

export async function fetchEarningsCalendar(dateNY: string): Promise<EarningsEntry[]> {
  const apiKey = process.env.EARNINGSAPI_KEY ?? ''
  const url = `https://api.earningsapi.com/v1/calendar/earnings?date=${dateNY}${apiKey ? `&apikey=${apiKey}` : ''}`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return []
    const json = await res.json()
    const all: any[] = json.earnings ?? json.data ?? (Array.isArray(json) ? json : [])
    return all
      .filter(e => e?.ticker && TOP50_SET.has(String(e.ticker).toUpperCase()))
      .map(e => ({
        ticker: String(e.ticker).toUpperCase(),
        name:   String(e.name ?? e.company ?? e.ticker),
        when:   e.when === 'pre' || e.when === 'before_open' || e.time === 'BMO'
                  ? 'before_open'
                  : e.when === 'post' || e.when === 'after_close' || e.time === 'AMC'
                  ? 'after_close'
                  : 'unknown',
      }))
  } catch { return [] }
}

// ── 日米連動（既存コードをそのまま維持）───────────────────────────────
type DailyChange = { time: number; date: string; changePct: number }

function toDailyChanges(quotes: DailyQuote[]): DailyChange[] {
  const changes: DailyChange[] = []
  for (let i = 1; i < quotes.length; i++) {
    const prev = quotes[i - 1]
    const cur  = quotes[i]
    const p    = prev.close !== 0 ? Math.round(((cur.close - prev.close) / prev.close) * 10000) / 100 : null
    if (p != null) changes.push({ time: cur.time, date: cur.date, changePct: p })
  }
  return changes
}

function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  const n = xs.length
  if (n < 2 || ys.length !== n) return null
  const meanX = xs.reduce((s, v) => s + v, 0) / n
  const meanY = ys.reduce((s, v) => s + v, 0) / n
  let cov = 0, varX = 0, varY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX, dy = ys[i] - meanY
    cov += dx * dy; varX += dx * dx; varY += dy * dy
  }
  if (varX === 0 || varY === 0) return null
  return Math.round((cov / Math.sqrt(varX * varY)) * 100) / 100
}

export type CoMovementPair = {
  usDate:         string
  usChangePct:    number
  nikkeiDate:     string
  nikkeiChangePct: number
}

export type CoMovementResult = {
  correlation:      number | null
  sameDirectionCount: number
  totalPairs:       number
  latestPair:       CoMovementPair | null
}

export async function fetchUsJapanCoMovement(lookbackDays = 20): Promise<CoMovementResult> {
  const [sp500Quotes, nikkeiQuotes] = await Promise.all([
    fetchYahooDaily(INDEX_SYMBOLS.sp500,  '3mo'),
    fetchYahooDaily(INDEX_SYMBOLS.nikkei, '3mo'),
  ])
  const usChanges     = toDailyChanges(sp500Quotes)
  const nikkeiChanges = toDailyChanges(nikkeiQuotes)
  const pairs: CoMovementPair[] = []
  for (const us of usChanges) {
    const next = nikkeiChanges.find(n => n.time > us.time)
    if (next) pairs.push({
      usDate:          us.date,
      usChangePct:     us.changePct,
      nikkeiDate:      next.date,
      nikkeiChangePct: next.changePct,
    })
  }
  const recent = pairs.slice(-lookbackDays)
  return {
    correlation:        pearsonCorrelation(recent.map(p => p.usChangePct), recent.map(p => p.nikkeiChangePct)),
    sameDirectionCount: recent.filter(p => Math.sign(p.usChangePct) === Math.sign(p.nikkeiChangePct)).length,
    totalPairs:         recent.length,
    latestPair:         pairs.at(-1) ?? null,
  }
}

// ── fetchAriaDailyData（個別株・決算追加）────────────────────────────────
export type AriaDailyData = {
  dateJst:    string
  sp500:      PeriodChange | null
  nasdaq:     PeriodChange | null
  sectors:    SectorChange[]
  coMovement: CoMovementResult
  stocks:     StockQuote[]      // ← 新規追加
  earnings:   EarningsEntry[]   // ← 新規追加
  errors:     string[]
}

export async function fetchAriaDailyData(): Promise<AriaDailyData> {
  const errors: string[] = []

  // NY日付（決算カレンダー用）
  const dateNY = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  const [sp500, nasdaq, sectors, coMovement, stocks, earnings] = await Promise.all([
    fetchPeriodChange(INDEX_SYMBOLS.sp500).catch(e => {
      errors.push(`sp500: ${e instanceof Error ? e.message : String(e)}`); return null
    }),
    fetchPeriodChange(INDEX_SYMBOLS.nasdaq).catch(e => {
      errors.push(`nasdaq: ${e instanceof Error ? e.message : String(e)}`); return null
    }),
    fetchSectorChanges().catch(e => {
      errors.push(`sectors: ${e instanceof Error ? e.message : String(e)}`); return []
    }),
    fetchUsJapanCoMovement().catch(e => {
      errors.push(`coMovement: ${e instanceof Error ? e.message : String(e)}`);
      return { correlation: null, sameDirectionCount: 0, totalPairs: 0, latestPair: null }
    }),
    fetchTop50Quotes().catch(e => {
      errors.push(`stocks: ${e instanceof Error ? e.message : String(e)}`); return []
    }),
    fetchEarningsCalendar(dateNY).catch(e => {
      errors.push(`earnings: ${e instanceof Error ? e.message : String(e)}`); return []
    }),
  ])

  return { dateJst: dateJST(), sp500, nasdaq, sectors, coMovement, stocks, earnings, errors }
}

// ── buildFacts（既存ロジック維持）──────────────────────────────────────
function formatSignedPercent(value: number): string {
  return `${value >= 0 ? 'プラス' : 'マイナス'}${Math.abs(value)}パーセント`
}
function directionSign(pct: number): -1 | 0 | 1 {
  if (pct > 0) return 1; if (pct < 0) return -1; return 0
}
function directionLabel(pct: number): '上昇' | '下落' | '横ばい' {
  const s = directionSign(pct); return s > 0 ? '上昇' : s < 0 ? '下落' : '横ばい'
}

export function buildFacts(data: AriaDailyData): string[] {
  const facts: string[] = []
  if (data.sp500?.changePct1m  != null) facts.push(`S&P500は1ヶ月前比${formatSignedPercent(data.sp500.changePct1m)}`)
  if (data.sp500?.changePct3m  != null) facts.push(`S&P500は3ヶ月前比${formatSignedPercent(data.sp500.changePct3m)}`)
  if (data.nasdaq?.changePct1m != null) facts.push(`NASDAQは1ヶ月前比${formatSignedPercent(data.nasdaq.changePct1m)}`)
  if (data.nasdaq?.changePct3m != null) facts.push(`NASDAQは3ヶ月前比${formatSignedPercent(data.nasdaq.changePct3m)}`)

  if (data.sectors.length > 0) {
    const sorted = [...data.sectors].sort((a, b) => (b.changePct1m ?? 0) - (a.changePct1m ?? 0))
    const best  = sorted[0]
    const worst = sorted[sorted.length - 1]
    if (best?.changePct1m  != null) facts.push(`セクター別では${best.labelJa}が1ヶ月で最も上昇（${formatSignedPercent(best.changePct1m)}）`)
    if (worst?.changePct1m != null && worst.key !== best?.key) facts.push(`${worst.labelJa}が1ヶ月で最も下落（${formatSignedPercent(worst.changePct1m)}）`)
  }

  // 個別株で大きく動いた銘柄をfactsに追加
  if (data.stocks.length > 0) {
    const sorted  = [...data.stocks].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    const topMover = sorted[0]
    if (topMover && Math.abs(topMover.changePct) >= 3) {
      const name = NOTABLE_NAMES[topMover.symbol] ?? topMover.symbol
      facts.push(`個別株では${name}が前日比${formatSignedPercent(topMover.changePct)}と大きく動いた`)
    }
  }

  const { latestPair, correlation, sameDirectionCount, totalPairs } = data.coMovement
  if (latestPair) {
    const usSign    = directionSign(latestPair.usChangePct)
    const nikkeiSign = directionSign(latestPair.nikkeiChangePct)
    const usDir     = directionLabel(latestPair.usChangePct)
    if (usSign === 0 || nikkeiSign === 0) {
      facts.push(`今回の米国株は${usDir}(${formatSignedPercent(latestPair.usChangePct)})、翌営業日の日経225は${directionLabel(latestPair.nikkeiChangePct)}(${formatSignedPercent(latestPair.nikkeiChangePct)})でした`)
    } else {
      const verb = usSign === nikkeiSign ? '波及' : '逆行'
      facts.push(`今回の米国株${usDir}は翌営業日の日経225にも${verb}(${formatSignedPercent(latestPair.nikkeiChangePct)})`)
    }
  }
  if (correlation != null && totalPairs > 0) {
    facts.push(`直近${totalPairs}営業日では、米国株の翌営業日の日経225への連動係数(相関)は${correlation}、同方向に動いた日は${sameDirectionCount}/${totalPairs}回でした`)
  }
  facts.push('※上記は単純な相関・同方向判定であり、統計的な因果関係を示すものではありません')
  return facts
}

// ── DB保存・取得────────────────────────────────────────────────────────
export type AriaDailyRecord = {
  date:                 string
  facts:                string[]
  sp500_change_pct_1m:  number | null
  sp500_change_pct_3m:  number | null
  nasdaq_change_pct_1m: number | null
  nasdaq_change_pct_3m: number | null
  sector_changes:       SectorChange[]
  comovement:           CoMovementResult
  stock_quotes:         StockQuote[]    // ← 新規
  earnings:             EarningsEntry[] // ← 新規
}

export function toAriaDailyRecord(data: AriaDailyData, facts: string[]): AriaDailyRecord {
  return {
    date:                 data.dateJst,
    facts,
    sp500_change_pct_1m:  data.sp500?.changePct1m  ?? null,
    sp500_change_pct_3m:  data.sp500?.changePct3m  ?? null,
    nasdaq_change_pct_1m: data.nasdaq?.changePct1m ?? null,
    nasdaq_change_pct_3m: data.nasdaq?.changePct3m ?? null,
    sector_changes:       data.sectors,
    comovement:           data.coMovement,
    stock_quotes:         data.stocks,
    earnings:             data.earnings,
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
  if (!cfg) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です')
  const { url, key } = cfg
  const existing = await fetch(`${url}/rest/v1/aria_daily_insights?date=eq.${record.date}&select=id`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  const rows  = await existing.json()
  const hasRow = Array.isArray(rows) && rows.length > 0
  const res = await fetch(
    hasRow ? `${url}/rest/v1/aria_daily_insights?date=eq.${record.date}` : `${url}/rest/v1/aria_daily_insights`,
    {
      method: hasRow ? 'PATCH' : 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(record),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase save failed: ${res.status} ${err.slice(0, 300)}`)
  }
}

export type AriaDailyRow = AriaDailyRecord & { id: number; created_at: string }

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
