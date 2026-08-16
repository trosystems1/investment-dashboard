import { sb, supabaseConfig } from './supabase'
import type { MarketContext, Property } from './score'

type DistrictRow = {
  unit_price_sqm_man: number | null
  unit_price_trend_3y: number | null
  unit_price_sqm_man_compact: number | null
  unit_price_trend_3y_compact: number | null
  compact_count: number | null
  trade_count: number | null
  zoning_top?: string | null
  avg_built_year?: number | null
}

/**
 * 住所から町丁目を切り出す。
 * 「東京都大田区矢口2丁目21-5」→ { city: '大田区', district: '矢口' }
 * 国交省 XIT001 の DistrictName は丁目を含まない町名なので、丁目・番地を落とす。
 */
export function parseAddress(address?: string | null, cityHint?: string | null) {
  const a = String(address ?? '')
  const cityMatch = a.match(/(品川区|目黒区|大田区|世田谷区)/)
  const city = cityMatch?.[1] ?? cityHint ?? null
  if (!city) return { city: null, district: null }

  const after = a.slice(a.indexOf(city) + city.length)
  const district = after
    .replace(/[0-9０-９]+丁目.*$/, '')
    .replace(/[0-9０-９].*$/, '')
    .replace(/[-−‐]/g, '')
    .trim() || null

  return { city, district }
}

/** 町丁目スコアを引き当てる。無ければ区の中央値にフォールバック。 */
export async function loadMarketContext(p: Property): Promise<MarketContext & {
  matched_level?: 'district' | 'city' | 'none'
  district?: string | null
}> {
  if (!supabaseConfig()) return { matched_level: 'none' }

  const { city, district } = parseAddress(p.address, p.city)
  if (!city) return { matched_level: 'none' }

  if (district) {
    const { data } = await sb<DistrictRow[]>(
      `fudosan_district_latest?select=unit_price_sqm_man,unit_price_trend_3y,unit_price_sqm_man_compact,unit_price_trend_3y_compact,compact_count,trade_count,zoning_top,avg_built_year&city=eq.${encodeURIComponent(city)}&district=eq.${encodeURIComponent(district)}`,
    )
    const row = data?.[0]
    if (row) {
      const useCompact = (row.compact_count ?? 0) >= 5 && row.unit_price_sqm_man_compact != null
      return {
        matched_level: 'district',
        district,
        station_unit_price_sqm_man: useCompact ? row.unit_price_sqm_man_compact : row.unit_price_sqm_man,
        unit_price_trend_3y: useCompact ? row.unit_price_trend_3y_compact : row.unit_price_trend_3y,
        trade_count: useCompact ? row.compact_count : row.trade_count,
        tier: useCompact ? 'compact' : 'all',
      }
    }
  }

  const { data: rows } = await sb<Pick<DistrictRow, 'unit_price_sqm_man_compact' | 'unit_price_sqm_man' | 'compact_count'>[]>(
    `fudosan_district_latest?select=unit_price_sqm_man_compact,unit_price_sqm_man,compact_count&city=eq.${encodeURIComponent(city)}`,
  )

  if (rows?.length) {
    const vals = rows
      .map(r => ((r.compact_count ?? 0) >= 5 ? r.unit_price_sqm_man_compact : r.unit_price_sqm_man))
      .filter((v): v is number => typeof v === 'number')
      .sort((a, b) => a - b)
    if (vals.length) {
      return {
        matched_level: 'city',
        district,
        city_unit_price_sqm_man: vals[Math.floor(vals.length / 2)],
        station_unit_price_sqm_man: vals[Math.floor(vals.length / 2)],
        trade_count: rows.length,
        tier: 'city-median',
      }
    }
  }

  return { matched_level: 'none', district }
}
