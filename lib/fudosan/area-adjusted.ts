import { unstable_cache } from 'next/cache'
import { sb, supabaseConfig } from './supabase'
import { computeAgeAdjusted, type AdjResult, type AdjRow, type AdjTrade } from './age-adjust'

/**
 * エリア分析に「築年調整後」の単価と上昇率を足すためのデータ読み込み。
 *
 * fudosan_trades（20〜30㎡のマンション成約）を読み、町名を Postgres 関数 fudosan_area_of で
 * 駅圏エリアに束ねてから computeAgeAdjusted に渡す。
 * エリアの束ね方は fudosan_area_stats と同じ関数を使うので、画面の行と1対1で対応する。
 *
 * 1万5千行と町名ぶんのRPCを読むので、結果は1日キャッシュする（成約データの更新は月1回）。
 */

type TradeRow = {
  city_name: string | null
  district_name: string | null
  period_year: number
  unit_price_sqm: number | null
  area_sqm: number | null
  building_year: string | null
}

export type AreaAdjusted = AdjRow & { city: string; district: string }

export type AreaAdjustedResult = Omit<AdjResult, 'rows'> & {
  rows: AreaAdjusted[]
  /** fudosan_trades の最終取込日時（cron が国交省から取った日） */
  fetched_at: string | null
  /** データに含まれる最新の成約四半期（例: 2026年第2四半期 → "2026Q2"） */
  latest_period: string | null
  computed_at: string
}

const PAGE = 1000
const DAY = 60 * 60 * 24
/** 取込 cron は月1回。キャッシュも1日で十分 */
const cacheInit = { next: { revalidate: DAY } } as RequestInit

async function fetchTrades(): Promise<TradeRow[]> {
  const base =
    'fudosan_trades?select=city_name,district_name,period_year,unit_price_sqm,area_sqm,building_year' +
    '&unit_price_sqm=not.is.null&area_sqm=gte.20&area_sqm=lte.30&order=id'

  // 件数を先に取り、ページを並列で読む（直列だと Vercel の時間制限に近づく）
  const head = await sb<TradeRow[]>(`${base}&limit=1`, { ...cacheInit, prefer: 'count=exact' })
  if (head.error) throw new Error(`fudosan_trades count failed: ${head.error}`)
  const total = head.count ?? 0
  const offsets = Array.from({ length: Math.ceil(total / PAGE) }, (_, i) => i * PAGE)

  const pages = await Promise.all(
    offsets.map(async off => {
      const { data, error } = await sb<TradeRow[]>(`${base}&limit=${PAGE}&offset=${off}`, cacheInit)
      if (error) throw new Error(`fudosan_trades page ${off} failed: ${error}`)
      return data ?? []
    }),
  )
  return pages.flat()
}

/** 町名 → 駅圏エリア名。fudosan_area_stats と同じ関数を使う */
async function mapAreas(pairs: Array<[string, string]>): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const BATCH = 20
  for (let i = 0; i < pairs.length; i += BATCH) {
    await Promise.all(
      pairs.slice(i, i + BATCH).map(async ([city, district]) => {
        const { data } = await sb<unknown>('rpc/fudosan_area_of', {
          ...cacheInit,
          method: 'POST',
          body: JSON.stringify({ city, district }),
        })
        const area =
          typeof data === 'string' ? data
            : Array.isArray(data) && typeof data[0] === 'string' ? data[0]
              : null
        // 関数がマッピングを持たない町は町名のまま（関数側の else d と同じ扱い）
        out.set(`${city}|${district}`, area || district)
      }),
    )
  }
  return out
}

async function fetchMeta(): Promise<{ fetched_at: string | null; latest_period: string | null }> {
  const [f, p] = await Promise.all([
    sb<Array<{ fetched_at: string }>>('fudosan_trades?select=fetched_at&order=fetched_at.desc&limit=1', cacheInit),
    sb<Array<{ period_year: number; period_quarter: number }>>(
      'fudosan_trades?select=period_year,period_quarter&order=period_year.desc,period_quarter.desc&limit=1',
      cacheInit,
    ),
  ])
  const latest = p.data?.[0]
  return {
    fetched_at: f.data?.[0]?.fetched_at ?? null,
    latest_period: latest ? `${latest.period_year}Q${latest.period_quarter}` : null,
  }
}

async function build(): Promise<AreaAdjustedResult> {
  const [raw, meta] = await Promise.all([fetchTrades(), fetchMeta()])

  const pairs = new Map<string, [string, string]>()
  for (const r of raw) {
    if (r.city_name && r.district_name) pairs.set(`${r.city_name}|${r.district_name}`, [r.city_name, r.district_name])
  }
  const areaOf = await mapAreas([...pairs.values()])

  const trades: AdjTrade[] = []
  for (const r of raw) {
    if (!r.city_name || !r.district_name) continue
    const by = r.building_year?.match(/(\d{4})/)
    const unit = Number(r.unit_price_sqm)
    const area = Number(r.area_sqm)
    if (!by || !unit || !area) continue
    const name = areaOf.get(`${r.city_name}|${r.district_name}`) ?? r.district_name
    trades.push({
      key: `${r.city_name}|${name}`,
      year: Number(r.period_year),
      unitYen: unit,
      areaSqm: area,
      builtYear: Number(by[1]),
    })
  }

  const res = computeAgeAdjusted(trades)
  return {
    ...res,
    rows: res.rows.map(row => {
      const [city, district] = row.key.split('|')
      return { ...row, city, district }
    }),
    ...meta,
    computed_at: new Date().toISOString(),
  }
}

const cached = unstable_cache(build, ['fudosan-area-adjusted-v1'], {
  revalidate: DAY,
  tags: ['fudosan-area-adjusted'],
})

/** 失敗しても画面は落とさない。築年調整の列が「—」になるだけ */
export async function loadAreaAdjusted(): Promise<AreaAdjustedResult | null> {
  if (!supabaseConfig()) return null
  try {
    return await cached()
  } catch (e) {
    console.error('[fudosan/area-adjusted]', e)
    return null
  }
}
