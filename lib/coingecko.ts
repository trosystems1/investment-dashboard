const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'

export const PRODUCT_TO_COINGECKO: Record<string, string> = {
  BTC_JPY: 'bitcoin',
  ETH_JPY: 'ethereum',
}

async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
  let lastErr: Error | null = null
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { next: { revalidate: 0 } })
      if (res.status === 429 && i < retries) {
        await new Promise((r) => setTimeout(r, 2000))
        continue
      }
      return res
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
      if (i < retries) await new Promise((r) => setTimeout(r, 1500))
    }
  }
  throw lastErr ?? new Error('CoinGecko fetch failed')
}

export function productToCoinId(productCode: string): string {
  return PRODUCT_TO_COINGECKO[productCode] ?? 'bitcoin'
}

export type PricePoint = { time: number; price: number }

export async function fetchMarketChart(
  coinId: string,
  days: number,
  vsCurrency = 'jpy',
): Promise<PricePoint[]> {
  const res = await fetchWithRetry(
    `${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=${vsCurrency}&days=${days}`,
  )
  if (!res.ok) throw new Error(`CoinGecko market_chart failed: ${res.status}`)
  const json = await res.json()
  const prices: [number, number][] = json.prices ?? []
  return prices.map(([ms, price]) => ({ time: Math.floor(ms / 1000), price }))
}

export async function fetchBtcDominance(): Promise<number> {
  const res = await fetchWithRetry(`${COINGECKO_BASE}/global`)
  if (!res.ok) throw new Error(`CoinGecko global failed: ${res.status}`)
  const json = await res.json()
  const pct = json.data?.market_cap_percentage?.btc
  if (typeof pct !== 'number') throw new Error('BTC dominance missing')
  return Math.round(pct * 100) / 100
}

export async function fetchStablecoinSupplyUsd(): Promise<number> {
  const res = await fetchWithRetry(
    `${COINGECKO_BASE}/coins/markets?vs_currency=usd&category=stablecoins&order=market_cap_desc&per_page=20`,
  )
  if (!res.ok) throw new Error(`CoinGecko stablecoins failed: ${res.status}`)
  const coins: Array<{ market_cap: number | null }> = await res.json()
  const total = coins.reduce((s, c) => s + (c.market_cap ?? 0), 0)
  if (total <= 0) throw new Error('Stablecoin supply missing')
  return Math.round(total)
}

export type FearGreedEntry = {
  value: number
  classification: string
  timestamp: number
}

export async function fetchFearGreed(limit = 90): Promise<FearGreedEntry[]> {
  const res = await fetch(`https://api.alternative.me/fng/?limit=${limit}`, {
    next: { revalidate: 300 },
  })
  if (!res.ok) throw new Error(`Fear & Greed failed: ${res.status}`)
  const json = await res.json()
  return (json.data ?? []).map((d: { value: string; value_classification: string; timestamp: string }) => ({
    value: Number(d.value),
    classification: d.value_classification,
    timestamp: Number(d.timestamp),
  }))
}
