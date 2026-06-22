import { fetchYahooQuoteChange } from './yahoo-finance'

export const MARKET_SYMBOLS = {
  nikkei: '^N225',
  sp500: '^GSPC',
  vix: '^VIX',
  usdjpy: 'JPY=X',
} as const

export const NIKKEI_VI_SYMBOL = process.env.NIKKEI_VI_YAHOO_SYMBOL || '^NKVI'
export const NIKKEI_VI_ALERT_THRESHOLD = Number(process.env.NIKKEI_VI_ALERT_THRESHOLD || '20')

export type MorningMarketData = {
  dateJst: string
  nikkei: Awaited<ReturnType<typeof fetchYahooQuoteChange>>
  nikkeiVi: Awaited<ReturnType<typeof fetchYahooQuoteChange>>
  sp500: Awaited<ReturnType<typeof fetchYahooQuoteChange>>
  vix: Awaited<ReturnType<typeof fetchYahooQuoteChange>>
  usdjpy: Awaited<ReturnType<typeof fetchYahooQuoteChange>>
  sqDaysRemaining: number
  viHigh: boolean
  errors: string[]
}

export function dateJST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

function jstDateParts(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { year: get('year'), month: get('month'), day: get('day') }
}

function secondFridayUtc(year: number, monthIndex: number): Date {
  const d = new Date(Date.UTC(year, monthIndex, 1))
  let fridays = 0
  for (let i = 0; i < 31; i++) {
    if (d.getUTCDay() === 5) {
      fridays += 1
      if (fridays === 2) return new Date(d)
    }
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return new Date(Date.UTC(year, monthIndex, 14))
}

function toJstMidnight(year: number, month: number, day: number): Date {
  return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00+09:00`)
}

function countBusinessDays(from: Date, to: Date): number {
  if (to <= from) return 0
  let count = 0
  const cur = new Date(from)
  cur.setDate(cur.getDate() + 1)
  while (cur <= to) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) count += 1
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

/** 次のSQ日（第2金曜）までの残り営業日数 */
export function calcSqDaysRemaining(): number {
  const { year, month, day } = jstDateParts()
  const today = toJstMidnight(year, month, day)
  let sq = secondFridayUtc(year, month - 1)
  let sqJst = toJstMidnight(sq.getUTCFullYear(), sq.getUTCMonth() + 1, sq.getUTCDate())
  if (today > sqJst) {
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    sq = secondFridayUtc(nextYear, nextMonth - 1)
    sqJst = toJstMidnight(sq.getUTCFullYear(), sq.getUTCMonth() + 1, sq.getUTCDate())
  }
  return countBusinessDays(today, sqJst)
}

export async function fetchMorningMarketData(): Promise<MorningMarketData> {
  const errors: string[] = []
  const [nikkei, nikkeiVi, sp500, vix, usdjpy] = await Promise.all([
    fetchYahooQuoteChange(MARKET_SYMBOLS.nikkei).catch((e) => {
      errors.push(`nikkei: ${e instanceof Error ? e.message : String(e)}`)
      return null
    }),
    fetchYahooQuoteChange(NIKKEI_VI_SYMBOL).catch((e) => {
      errors.push(`nikkeiVi: ${e instanceof Error ? e.message : String(e)}`)
      return null
    }),
    fetchYahooQuoteChange(MARKET_SYMBOLS.sp500).catch((e) => {
      errors.push(`sp500: ${e instanceof Error ? e.message : String(e)}`)
      return null
    }),
    fetchYahooQuoteChange(MARKET_SYMBOLS.vix).catch((e) => {
      errors.push(`vix: ${e instanceof Error ? e.message : String(e)}`)
      return null
    }),
    fetchYahooQuoteChange(MARKET_SYMBOLS.usdjpy).catch((e) => {
      errors.push(`usdjpy: ${e instanceof Error ? e.message : String(e)}`)
      return null
    }),
  ])

  const viLevel = nikkeiVi?.close ?? null
  return {
    dateJst: dateJST(),
    nikkei,
    nikkeiVi,
    sp500,
    vix,
    usdjpy,
    sqDaysRemaining: calcSqDaysRemaining(),
    viHigh: viLevel != null && viLevel >= NIKKEI_VI_ALERT_THRESHOLD,
    errors,
  }
}

export type MorningSummaryRecord = {
  date: string
  nikkei_close: number | null
  nikkei_change_pct: number | null
  nikkei_vi: number | null
  sp500_close: number | null
  sp500_change_pct: number | null
  vix_close: number | null
  usdjpy: number | null
  sq_days_remaining: number
  summary_text: string
}

export function toSummaryRecord(data: MorningMarketData, summaryText: string): MorningSummaryRecord {
  return {
    date: data.dateJst,
    nikkei_close: data.nikkei?.close ?? null,
    nikkei_change_pct: data.nikkei?.changePct ?? null,
    nikkei_vi: data.nikkeiVi?.close ?? null,
    sp500_close: data.sp500?.close ?? null,
    sp500_change_pct: data.sp500?.changePct ?? null,
    vix_close: data.vix?.close ?? null,
    usdjpy: data.usdjpy?.close ?? null,
    sq_days_remaining: data.sqDaysRemaining,
    summary_text: summaryText,
  }
}

export function formatDataForPrompt(data: MorningMarketData): string {
  const fmt = (label: string, q: typeof data.nikkei, suffix = '') =>
    q
      ? `${label}: ${q.close}${suffix}（前日比 ${q.change >= 0 ? '+' : ''}${q.change} / ${q.changePct >= 0 ? '+' : ''}${q.changePct}%）`
      : `${label}: 取得失敗`

  return [
    fmt('日経平均', data.nikkei),
    data.nikkeiVi
      ? `日経VI: ${data.nikkeiVi.close}（前日比 ${data.nikkeiVi.changePct >= 0 ? '+' : ''}${data.nikkeiVi.changePct}%）${data.viHigh ? ' ※警戒水準超え' : ''}`
      : '日経VI: 取得失敗',
    fmt('S&P500', data.sp500),
    fmt('VIX', data.vix),
    fmt('USD/JPY', data.usdjpy),
    `SQ日までの残り営業日数: ${data.sqDaysRemaining}日`,
  ].join('\n')
}

export async function generateGeminiSummary(data: MorningMarketData): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return '（GEMINI_API_KEY 未設定のため自動要約をスキップしました）'
  }

  const model = process.env.GEMINI_MODEL || 'gemini-1.5-pro'
  const prompt = `以下の市場データから、日経225オプション取引に影響しそうなポイントを3つ以内で要約してください。日経VIの水準とSQ日までの残り日数を踏まえて判断してください。箇条書きで簡潔に。投資助言ではなく個人の調査メモとして書いてください。

${formatDataForPrompt(data)}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    },
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API failed: ${res.status} ${err.slice(0, 200)}`)
  }

  const json = await res.json()
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned empty response')
  return String(text).trim()
}

export async function saveMorningSummary(record: MorningSummaryRecord): Promise<void> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です')
  }

  const existing = await fetch(
    `${url}/rest/v1/nikkei_option_morning_summary?date=eq.${record.date}&select=id`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    },
  )
  const rows = await existing.json()
  const hasRow = Array.isArray(rows) && rows.length > 0

  const endpoint = hasRow
    ? `${url}/rest/v1/nikkei_option_morning_summary?date=eq.${record.date}`
    : `${url}/rest/v1/nikkei_option_morning_summary`

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

export type MorningSummaryRow = MorningSummaryRecord & {
  id: number
  created_at: string
}

export async function listMorningSummaries(limit = 30): Promise<MorningSummaryRow[]> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return []

  const res = await fetch(
    `${url}/rest/v1/nikkei_option_morning_summary?select=*&order=date.desc&limit=${limit}`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 300 },
    },
  )
  if (!res.ok) return []
  return res.json()
}
