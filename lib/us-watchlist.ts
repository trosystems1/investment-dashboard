// US株ウォッチリスト用の銘柄マスタ・データ取得ロジック
// Yahoo Finance v8/chart（APIキー不要）を使用

export type USTicker = {
  ticker: string
  companyName: string
  sector: string
}

export const US_WATCHLIST_TICKERS: USTicker[] = [
  { ticker: 'NVDA', companyName: 'エヌビディア', sector: 'Technology' },
  { ticker: 'MSFT', companyName: 'マイクロソフト', sector: 'Technology' },
  { ticker: 'AAPL', companyName: 'アップル', sector: 'Technology' },
  { ticker: 'AMZN', companyName: 'アマゾン', sector: 'Consumer' },
  { ticker: 'META', companyName: 'メタ', sector: 'Technology' },
  { ticker: 'GOOGL', companyName: 'アルファベット', sector: 'Technology' },
  { ticker: 'TSLA', companyName: 'テスラ', sector: 'Consumer' },
  { ticker: 'AVGO', companyName: 'ブロードコム', sector: 'Technology' },
  { ticker: 'ORCL', companyName: 'オラクル', sector: 'Technology' },
  { ticker: 'CRM', companyName: 'セールスフォース', sector: 'Technology' },
  { ticker: 'JPM', companyName: 'JPモルガン', sector: 'Finance' },
  { ticker: 'AMD', companyName: 'AMD', sector: 'Technology' },
  { ticker: 'MA', companyName: 'マスターカード', sector: 'Finance' },
  { ticker: 'NFLX', companyName: 'ネットフリックス', sector: 'Communication' },
  { ticker: 'UNH', companyName: 'ユナイテッドヘルス', sector: 'Healthcare' },
  { ticker: 'LLY', companyName: 'イーライリリー', sector: 'Healthcare' },
  { ticker: 'ADBE', companyName: 'アドビ', sector: 'Technology' },
  { ticker: 'HD', companyName: 'ホームデポ', sector: 'Consumer' },
  { ticker: 'AXP', companyName: 'アメックス', sector: 'Finance' },
  { ticker: 'WMT', companyName: 'ウォルマート', sector: 'Consumer' },
  { ticker: 'NOW', companyName: 'サービスナウ', sector: 'Technology' },
  { ticker: 'QCOM', companyName: 'クアルコム', sector: 'Technology' },
  { ticker: 'TXN', companyName: 'テキサス・インスツルメンツ', sector: 'Technology' },
  { ticker: 'MCD', companyName: 'マクドナルド', sector: 'Consumer' },
  { ticker: 'DIS', companyName: 'ディズニー', sector: 'Communication' },
  { ticker: 'JNJ', companyName: 'ジョンソン&ジョンソン', sector: 'Healthcare' },
  { ticker: 'COST', companyName: 'コストコ', sector: 'Consumer' },
  { ticker: 'XOM', companyName: 'エクソンモービル', sector: 'Energy' },
  { ticker: 'INTC', companyName: 'インテル', sector: 'Technology' },
  { ticker: 'IBM', companyName: 'IBM', sector: 'Technology' },
  { ticker: 'CSCO', companyName: 'シスコシステムズ', sector: 'Technology' },
  { ticker: 'BAC', companyName: 'バンクオブアメリカ', sector: 'Finance' },
  { ticker: 'ABBV', companyName: 'アッヴィ', sector: 'Healthcare' },
  { ticker: 'MRK', companyName: 'メルク', sector: 'Healthcare' },
  { ticker: 'PG', companyName: 'P&G', sector: 'Consumer' },
  { ticker: 'CAT', companyName: 'キャタピラー', sector: 'Industrial' },
  { ticker: 'GE', companyName: 'GE', sector: 'Industrial' },
  { ticker: 'MU', companyName: 'マイクロン', sector: 'Technology' },
  { ticker: 'NKE', companyName: 'ナイキ', sector: 'Consumer' },
  { ticker: 'CMCSA', companyName: 'コムキャスト', sector: 'Communication' },
  { ticker: 'TMUS', companyName: 'Tモバイル', sector: 'Communication' },
  { ticker: 'MS', companyName: 'モルガン・スタンレー', sector: 'Finance' },
  { ticker: 'GS', companyName: 'ゴールドマン・サックス', sector: 'Finance' },
  { ticker: 'BA', companyName: 'ボーイング', sector: 'Industrial' },
  { ticker: 'CVX', companyName: 'シェブロン', sector: 'Energy' },
  { ticker: 'SBUX', companyName: 'スターバックス', sector: 'Consumer' },
  { ticker: 'PFE', companyName: 'ファイザー', sector: 'Healthcare' },
  { ticker: 'KO', companyName: 'コカ・コーラ', sector: 'Consumer' },
  { ticker: 'PEP', companyName: 'ペプシコ', sector: 'Consumer' },
  { ticker: 'NEE', companyName: 'ネクステラ・エナジー', sector: 'Utilities' },
  { ticker: 'SPCX', companyName: 'スペースX', sector: 'Industrial' },
  { ticker: 'PLTR', companyName: 'パランティア', sector: 'Technology' },
  { ticker: 'UBER', companyName: 'ウーバー', sector: 'Technology' },
  { ticker: 'DOCU', companyName: 'ドキュサイン', sector: 'Technology' },
  { ticker: 'CBRS', companyName: 'セレブラス・システムズ', sector: 'Technology' },
  { ticker: 'ACHR', companyName: 'アーチャー・アビエーション', sector: 'Industrial' },
  { ticker: 'MNDY', companyName: 'monday.com', sector: 'Technology' },
  { ticker: 'SNOW', companyName: 'スノーフレイク', sector: 'Technology' },
  { ticker: 'COIN', companyName: 'コインベース', sector: 'Finance' },
  { ticker: 'CRSP', companyName: 'CRISPRセラピューティクス', sector: 'Healthcare' },
]

export type USQuote = {
  ticker: string
  companyName: string
  sector: string
  price: number | null
  open: number | null
  change: number | null
  changePct: number | null
  volume: number | null
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
  dayHigh: number | null
  dayLow: number | null
  sparkline: number[]
}

export type RangePreset = '1mo' | '3mo' | '6mo' | '1y'

const RANGE_PARAMS: Record<RangePreset, { range: string; interval: string }> = {
  '1mo': { range: '1mo', interval: '1d' },
  '3mo': { range: '3mo', interval: '1d' },
  '6mo': { range: '6mo', interval: '1wk' },
  '1y': { range: '1y', interval: '1wk' },
}

async function fetchChart(ticker: string, range = '5d', interval = '1d') {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ARIA-Watchlist/1.0)' }, next: { revalidate: 300 } }
  )
  if (!res.ok) return null
  const json = await res.json()
  return json?.chart?.result?.[0] ?? null
}

async function fetchOne(ticker: string): Promise<Omit<USQuote, 'ticker' | 'companyName' | 'sector'>> {
  const empty = {
    price: null, open: null, change: null, changePct: null, volume: null,
    fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null, dayHigh: null, dayLow: null,
    sparkline: [] as number[],
  }
  try {
    const result = await fetchChart(ticker, '5d', '1d')
    if (!result) return empty
    const meta = result.meta ?? {}
    const closesRaw: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? []
    const opensRaw: (number | null)[] = result?.indicators?.quote?.[0]?.open ?? []
    const volumesRaw: (number | null)[] = result?.indicators?.quote?.[0]?.volume ?? []
    const validIdx = closesRaw.map((v, i) => (v != null && !isNaN(v) ? i : -1)).filter((i) => i >= 0)
    if (validIdx.length < 2) {
      return {
        ...empty,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
      }
    }
    const lastI = validIdx[validIdx.length - 1]
    const prevI = validIdx[validIdx.length - 2]
    const curr = closesRaw[lastI] as number
    const prev = closesRaw[prevI] as number
    const change = parseFloat((curr - prev).toFixed(2))
    const changePct = prev ? parseFloat((((curr - prev) / prev) * 100).toFixed(2)) : null
    const volume = volumesRaw[lastI] ?? meta.regularMarketVolume ?? null
    const open = opensRaw[lastI] ?? meta.regularMarketOpen ?? null
    const sparkline = validIdx.slice(-10).map((i) => closesRaw[i] as number)
    return {
      price: parseFloat(curr.toFixed(2)),
      open: open != null ? parseFloat(Number(open).toFixed(2)) : null,
      change,
      changePct,
      volume,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
      dayHigh: meta.regularMarketDayHigh ?? null,
      dayLow: meta.regularMarketDayLow ?? null,
      sparkline,
    }
  } catch {
    return empty
  }
}

export async function fetchUSWatchlist(): Promise<USQuote[]> {
  const results = await Promise.all(
    US_WATCHLIST_TICKERS.map(async (t) => {
      const q = await fetchOne(t.ticker)
      return { ticker: t.ticker, companyName: t.companyName, sector: t.sector, ...q }
    })
  )
  return results
}

export async function fetchUSQuote(ticker: string): Promise<USQuote | null> {
  const meta = US_WATCHLIST_TICKERS.find((t) => t.ticker === ticker)
  if (!meta) return null
  const q = await fetchOne(ticker)
  return { ticker: meta.ticker, companyName: meta.companyName, sector: meta.sector, ...q }
}

export type ChartPoint = { date: string; value: number }

export async function fetchUSChartRange(ticker: string, preset: RangePreset): Promise<ChartPoint[]> {
  const { range, interval } = RANGE_PARAMS[preset]
  const result = await fetchChart(ticker, range, interval)
  if (!result) return []
  const timestamps: number[] = result.timestamp ?? []
  const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? []
  const points: ChartPoint[] = []
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i]
    if (c != null && !isNaN(c)) {
      const d = new Date(timestamps[i] * 1000)
      const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`
      points.push({ date: dateLabel, value: parseFloat(c.toFixed(2)) })
    }
  }
  return points
}
