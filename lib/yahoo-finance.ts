export type DailyQuote = {
  date: string
  time: number
  close: number
}

export type YahooQuoteSnapshot = {
  symbol: string
  close: number
  prevClose: number
  change: number
  changePct: number
}

/** Yahoo Finance chart API（DXY 等） */
export async function fetchYahooDaily(symbol: string, range = '1y'): Promise<DailyQuote[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Yahoo chart failed: ${res.status} ${symbol}`)

  const json = await res.json()
  const result = json.chart?.result?.[0]
  const timestamps: number[] = result?.timestamp ?? []
  const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? []

  return timestamps
    .map((t, i) => {
      const close = closes[i]
      if (close == null || Number.isNaN(close)) return null
      const d = new Date(t * 1000)
      return {
        date: d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
        time: t,
        close,
      }
    })
    .filter((q): q is DailyQuote => q != null)
}

/** 直近2営業日分から前日比・変化率を算出 */
export async function fetchYahooQuoteChange(symbol: string): Promise<YahooQuoteSnapshot | null> {
  const quotes = await fetchYahooDaily(symbol, '1mo')
  if (quotes.length < 2) return null
  const latest = quotes[quotes.length - 1]
  const prev = quotes[quotes.length - 2]
  const change = latest.close - prev.close
  const changePct = prev.close !== 0 ? (change / prev.close) * 100 : 0
  return {
    symbol,
    close: latest.close,
    prevClose: prev.close,
    change: Math.round(change * 100) / 100,
    changePct: Math.round(changePct * 100) / 100,
  }
}
