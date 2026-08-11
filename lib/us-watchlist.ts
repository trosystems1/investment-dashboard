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
  { ticker: 'CBRS', companyName: 'セレブラス・シスツムズ', sector: 'Technology' },
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
  changePct: number | null
  volume: number | null
  marketCap: number | null
  sparkline: number[]
}

export type RangePreset = 'day' | 'month' | 'year'

const RANGE_PARAMS: Record<RangePreset, { range: string; interval: string }> = {
  day: { range: '1d', interval: '5m' },
  month: { range: '1mo', interval: '1d' },
  year: { range: '1y', interval: '1wk' },
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

// 時顢緝儯はv8/chartぎmetaに含まれないケースがあるためquoteSummaryを試す(失敗時はnullにフォールバック、ページブルは壁さない)
async function fetchMarketCap(ticker: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=price`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ARIA-Watchlist/1.0)' }, next: { revalidate: 3600 } }
    )
    if (!res.ok) return null
    const json = await res.json()
    const cap = json?.quoteSummary?.result?.[0]?.price?.marketCap?.raw
    return typeof cap === 'number' ? cap : null
  } catch {
    return null
  }
}

async function fetchOne(ticker: string): Promise<Omit<USQuote, 'ticker' | 'companyName' | 'sector'>> {
  try {
    const [result, marketCap] = await Promise.all([fetchChart(ticker, '5d', '1d'), fetchMarketCap(ticker)])
    if (!result) return { price: null, changePct: null, volume: null, marketCap, sparkline: [] }
    const closesRaw: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? []
    const volumesRaw: (number | null)[] = result?.indicators?.quote?.[0]?.volume ?? []
    const validIdx = closesRaw.map((v, i) => (v != null && !isNaN(v) ? i : -1)).filter((i) => i >= 0)
    if (validIdx.length < 2) return { price: null, changePct: null, volume: null, marketCap, sparkline: [] }
    const lastI = validIdx[validIdx.length - 1]
    const prevI = validIdx[validIdx.length - 2]
    const curr = closesRaw[lastI] as number
    const prev = closesRaw[prevI] as number
    const changePct = prev ? parseFloat((((curr - prev) / prev) * 100).toFixed(2)) : null
    const volume = volumesRaw[lastI] ?? null
    const sparkline = validIdx.slice(-10).map((i) => closesRaw[i] as number)
    return { price: parseFloat(curr.toFixed(2)), changePct, volume, marketCap, sparkline }
  } catch {
    return { price: null, changePct: null, volume: null, marketCap: null, sparkline: [] }
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

export type ChartPoint = { time: number; close: number }

export async function fetchUSChartRange(ticker: string, preset: RangePreset): Promise<ChartPoint[]> {
  const { range, interval } = RANGE_PARAMS[preset]
  const result = await fetchChart(ticker, range, interval)
  if (!result) return []
  const timestamps: number[] = result.timestamp ?? []
  const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? []
  const points: ChartPoint[] = []
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i]
    if (c != null && !isNaN(c)) points.push({ time: timestamps[i], close: c })
  }
  return points
}
