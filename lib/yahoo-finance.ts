export type DailyQuote = {
  date: string
  time: number
  close: number
}

/** Yahoo Finance chart API（DXY 等） */
export async function fetchYahooDaily(symbol: string, range = '1y'): Promise<DailyQuote[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`
  const res = await fetch(url, { next: { revalidate: 3600 } })
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
