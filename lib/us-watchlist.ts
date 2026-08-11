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
  sparkline: number[]
}

async function fetchOne(ticker: string): Promise<{ price: number | null; changePct: number | null; sparkline: number[] }> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ARIA-Watchlist/1.0)' }, next: { revalidate: 300 } }
    )
    if (!res.ok) return { price: null, changePct: null, sparkline: [] }
    const json = await res.json()
    const result = json?.chart?.result?.[0]
    const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? []
    const valid = closes.filter((v): v is number => v != null && !isNaN(v))
    if (valid.length < 2) return { price: null, changePct: null, sparkline: valid }
    const curr = valid[valid.length - 1]
    const prev = valid[valid.length - 2]
    const changePct = prev ? parseFloat((((curr - prev) / prev) * 100).toFixed(2)) : null
    return { price: parseFloat(curr.toFixed(2)), changePct, sparkline: valid.slice(-10) }
  } catch {
    return { price: null, changePct: null, sparkline: [] }
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
