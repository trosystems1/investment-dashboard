import { sb, supabaseConfig } from './supabase'
import type { MarketContext, Property } from './score'

/**
 * 相場の引き当ては fudosan_geo_stats（12年分の成約から作った土台ビュー）を見る。
 * エリア分析画面 /fudosan/areas と同じ数字なので、画面と物件判定がズレない。
 *
 * 旧実装は fudosan_district_latest（月次スナップショット）を見ていた。
 * あのテーブルの unit_price_sqm_man は「直近2年の成約」だけで作られるため、
 * 生涯46件あっても直近に売買がない町（例: 目黒区平町）は NULL になり、
 * 地区にヒットしたまま相場比較が黙って消えていた。
 */
type GeoRow = {
  level: string | null
  city: string
  district: string
  trade_count: number
  unit_price_man: number | null
  price_med_man: number | null
  trend_3y: number | null
  trend_10y: number | null
  built_year_med: number | null
  zoning_top: string | null
}

const SELECT =
  'select=level,city,district,trade_count,unit_price_man,price_med_man,trend_3y,trend_10y,built_year_med,zoning_top'

/** 町名で確定させるのに必要な最低成約件数。これ未満なら駅圏エリアまで引く。 */
const MIN_TOWN_TRADES = 10

const q = (v: string) => encodeURIComponent(v)

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

type Resolved = MarketContext & {
  matched_level?: 'town' | 'area' | 'city' | 'none'
  district?: string | null
}

function toContext(
  level: 'town' | 'area',
  row: GeoRow,
  district: string | null,
  scopeLabel: string,
): Resolved {
  return {
    matched_level: level,
    district,
    scope_label: scopeLabel,
    station_unit_price_sqm_man: row.unit_price_man,
    unit_price_trend_3y: row.trend_3y,
    unit_price_trend_10y: row.trend_10y,
    price_med_man: row.price_med_man,
    built_year_med: row.built_year_med,
    zoning_top: row.zoning_top,
    trade_count: row.trade_count,
    tier: '専有20〜30㎡',
  }
}

/** 町名がどの駅圏エリアに属するかは Postgres 関数に集約されている。失敗しても黙って諦める。 */
async function areaOf(city: string, district: string): Promise<string | null> {
  try {
    const { data, error } = await sb<unknown>('rpc/fudosan_area_of', {
      method: 'POST',
      body: JSON.stringify({ city, district }),
    })
    if (error || data == null) return null
    if (typeof data === 'string') return data || null
    if (Array.isArray(data) && typeof data[0] === 'string') return data[0] || null
    return null
  } catch {
    return null
  }
}

export async function loadMarketContext(p: Property): Promise<Resolved> {
  if (!supabaseConfig()) return { matched_level: 'none' }

  const { city, district } = parseAddress(p.address, p.city)
  if (!city) return { matched_level: 'none' }

  // 1) 町名で当てる（いちばん細かい）
  if (district) {
    const { data, error } = await sb<GeoRow[]>(
      `fudosan_geo_stats?${SELECT}&level=eq.town&city=eq.${q(city)}&district=eq.${q(district)}&limit=1`,
    )
    if (error) console.error('[fudosan/market] town lookup failed', error)
    const row = data?.[0]
    if (row && row.unit_price_man != null && row.trade_count >= MIN_TOWN_TRADES) {
      return toContext('town', row, district, `${city}${district}（町名）`)
    }
  }

  // 2) 町名が薄ければ、その町を含む駅圏エリアまで引く
  if (district) {
    const area = await areaOf(city, district)
    if (area) {
      const { data, error } = await sb<GeoRow[]>(
        `fudosan_geo_stats?${SELECT}&level=eq.area&city=eq.${q(city)}&district=eq.${q(area)}&limit=1`,
      )
      if (error) console.error('[fudosan/market] area lookup failed', error)
      const row = data?.[0]
      if (row && row.unit_price_man != null) {
        return toContext('area', row, district, `${city}${area}エリア（駅圏）`)
      }
    }
  }

  // 3) それも無ければ区内エリアの中央値
  const { data: rows, error: cityErr } = await sb<GeoRow[]>(
    `fudosan_geo_stats?${SELECT}&level=eq.area&city=eq.${q(city)}`,
  )
  if (cityErr) console.error('[fudosan/market] city lookup failed', cityErr)
  const vals = (rows ?? [])
    .map(r => r.unit_price_man)
    .filter((v): v is number => typeof v === 'number')
    .sort((a, b) => a - b)

  if (vals.length) {
    const med = vals[Math.floor(vals.length / 2)]
    const trades = (rows ?? []).reduce((s, r) => s + (r.trade_count ?? 0), 0)
    return {
      matched_level: 'city',
      district,
      scope_label: `${city}（区内${vals.length}エリアの中央値）`,
      city_unit_price_sqm_man: med,
      station_unit_price_sqm_man: med,
      trade_count: trades,
      tier: '専有20〜30㎡',
    }
  }

  return { matched_level: 'none', district }
}
