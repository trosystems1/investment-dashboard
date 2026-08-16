import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/fudosan/supabase'

// 国土交通省「不動産情報ライブラリ」から城南4区の成約価格を取り込む。
// 毎月1日 03:00 UTC 実行（vercel.json）。キーは https://www.reinfolib.mlit.go.jp/api/request/
// 正はここ。n8n「不動産_城南エリアデータ蓄積」のスケジュールは無効化すること。
// 同じ日に両方走ると fudosan_district_scores の unique(city, district, calculated_for) で衝突する。

export const runtime = 'nodejs'
export const maxDuration = 300

const API = 'https://www.reinfolib.mlit.go.jp/ex-api/external'
const KEY = process.env.REINFOLIB_API_KEY ?? ''

const CITIES = [
  { code: '13109', name: '品川区' },
  { code: '13110', name: '目黒区' },
  { code: '13111', name: '大田区' },
  { code: '13112', name: '世田谷区' },
]

type TradeRow = {
  Type?: string
  MunicipalityCode?: string
  Municipality?: string
  DistrictName?: string
  NearestStation?: string
  TradePrice?: string
  Area?: string
  FloorPlan?: string
  BuildingYear?: string
  Structure?: string
  UnitPrice?: string
  Period?: string
}

type StoredTrade = {
  city_name: string | null
  city_code: string
  district_name: string | null
  station_name: string | null
  period_year: number
  unit_price_sqm: number | null
  area_sqm: number | null
  building_year: string | null
}

async function fetchTrades(cityCode: string, year: number, quarter: number): Promise<TradeRow[]> {
  const url = `${API}/XIT001?year=${year}&quarter=${quarter}&city=${cityCode}`
  const res = await fetch(url, { headers: { 'Ocp-Apim-Subscription-Key': KEY } })
  if (!res.ok) throw new Error(`XIT001 ${cityCode} ${year}Q${quarter}: ${res.status}`)
  const json = (await res.json()) as { status?: string; data?: TradeRow[] }
  return json.data ?? []
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const median = (a: number[]) => {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  return s[Math.floor(s.length / 2)]
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-vercel-cron')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}` && cronHeader !== '1') {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!KEY) return NextResponse.json({ ok: false, error: 'REINFOLIB_API_KEY not set' }, { status: 500 })

  const now = new Date()
  const backQuarters = Number(new URL(req.url).searchParams.get('quarters') ?? 12)
  const jobs: { year: number; quarter: number }[] = []
  let y = now.getFullYear()
  let q = Math.floor(now.getMonth() / 3) + 1
  for (let i = 0; i < backQuarters; i++) {
    q -= 1
    if (q === 0) { q = 4; y -= 1 }
    jobs.push({ year: y, quarter: q })
  }

  let inserted = 0
  const errors: string[] = []

  for (const city of CITIES) {
    for (const job of jobs) {
      try {
        const rows = await fetchTrades(city.code, job.year, job.quarter)
        const mansions = rows.filter(r => (r.Type ?? '').includes('マンション'))
        if (!mansions.length) { await sleep(300); continue }

        const payload = mansions.map(r => {
          const price = Number(r.TradePrice ?? 0)
          const area = Number(r.Area ?? 0)
          return {
            prefecture_code: '13',
            city_code: city.code,
            city_name: city.name,
            district_name: r.DistrictName ?? null,
            station_name: r.NearestStation ?? null,
            trade_type: r.Type ?? null,
            period_year: job.year,
            period_quarter: job.quarter,
            trade_price: price || null,
            area_sqm: area || null,
            unit_price_sqm: price && area ? Math.round(price / area) : null,
            floor_plan: r.FloorPlan ?? null,
            building_year: r.BuildingYear ?? null,
            structure: r.Structure ?? null,
            raw: r as unknown as Record<string, unknown>,
          }
        })

        const { error } = await sb('fudosan_trades?on_conflict=city_code,district_name,station_name,period_year,period_quarter,trade_price,area_sqm', {
          method: 'POST',
          prefer: 'resolution=ignore-duplicates,return=minimal',
          body: JSON.stringify(payload),
        })
        if (error) errors.push(`${city.name} ${job.year}Q${job.quarter}: ${error}`)
        else inserted += payload.length

        await sleep(500)
      } catch (e) {
        errors.push(String(e))
        await sleep(1000)
      }
    }
  }

  await recalcStationScores()
  await recalcDistrictScores()

  return NextResponse.json({ ok: true, inserted, errors: errors.slice(0, 20) })
}

async function fetchAllTrades(): Promise<StoredTrade[]> {
  const pageSize = 1000
  const all: StoredTrade[] = []
  for (let offset = 0; offset < 20000; offset += pageSize) {
    const { data, error } = await sb<StoredTrade[]>(
      `fudosan_trades?select=city_name,city_code,district_name,station_name,period_year,unit_price_sqm,area_sqm,building_year&unit_price_sqm=not.is.null&limit=${pageSize}&offset=${offset}`,
    )
    if (error || !data?.length) break
    all.push(...data)
    if (data.length < pageSize) break
  }
  return all
}

async function recalcStationScores() {
  const data = await fetchAllTrades()
  const withStation = data.filter(r => r.station_name)
  if (!withStation.length) return

  const byStation = new Map<string, { city: string; recent: number[]; old: number[]; count: number }>()
  const thisYear = new Date().getFullYear()
  for (const r of withStation) {
    const st = r.station_name as string
    if (!byStation.has(st)) byStation.set(st, { city: r.city_name ?? '', recent: [], old: [], count: 0 })
    const b = byStation.get(st)!
    b.count += 1
    const v = Number(r.unit_price_sqm)
    if (r.period_year >= thisYear - 1) b.recent.push(v)
    else if (r.period_year <= thisYear - 3) b.old.push(v)
  }

  const today = new Date().toISOString().slice(0, 10)
  const rows = [...byStation.entries()].map(([station, b]) => {
    const recent = median(b.recent)
    const old = median(b.old)
    return {
      station,
      line: null,
      city: b.city,
      calculated_for: today,
      unit_price_sqm_man: recent ? +(recent / 10000).toFixed(1) : null,
      unit_price_trend_3y: recent && old ? +(((recent / old) - 1) * 100).toFixed(1) : null,
      trade_count: b.count,
      detail: { recent_n: b.recent.length, old_n: b.old.length },
      updated_at: new Date().toISOString(),
    }
  })

  for (let i = 0; i < rows.length; i += 200) {
    await sb('fudosan_station_scores?on_conflict=station,line,calculated_for', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: JSON.stringify(rows.slice(i, i + 200)),
    })
  }
}

/** 町丁目ごとの成約㎡単価中央値と3年トレンド。判定はこちらを使う。 */
async function recalcDistrictScores() {
  const data = await fetchAllTrades()
  const withDistrict = data.filter(r => r.district_name && r.city_name)
  if (!withDistrict.length) return

  type Bucket = {
    city: string
    city_code: string
    recent: number[]
    old: number[]
    compactRecent: number[]
    compactOld: number[]
    areas: number[]
    years: number[]
    count: number
    compactCount: number
  }
  const byDistrict = new Map<string, Bucket>()
  const thisYear = new Date().getFullYear()

  for (const r of withDistrict) {
    const key = `${r.city_name}|${r.district_name}`
    if (!byDistrict.has(key)) {
      byDistrict.set(key, {
        city: r.city_name as string,
        city_code: r.city_code,
        recent: [], old: [], compactRecent: [], compactOld: [],
        areas: [], years: [], count: 0, compactCount: 0,
      })
    }
    const b = byDistrict.get(key)!
    const v = Number(r.unit_price_sqm)
    const area = Number(r.area_sqm ?? 0)
    const compact = area >= 20 && area <= 40
    b.count += 1
    if (area) b.areas.push(area)
    const by = r.building_year?.match(/(\d{4})/)
    if (by) b.years.push(Number(by[1]))
    if (compact) b.compactCount += 1
    if (r.period_year >= thisYear - 1) {
      b.recent.push(v)
      if (compact) b.compactRecent.push(v)
    } else if (r.period_year <= thisYear - 3) {
      b.old.push(v)
      if (compact) b.compactOld.push(v)
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const rows = [...byDistrict.entries()].map(([key, b]) => {
    const district = key.split('|')[1]
    const recent = median(b.recent)
    const old = median(b.old)
    const compactRecent = median(b.compactRecent)
    const compactOld = median(b.compactOld)
    const avgArea = b.areas.length ? b.areas.reduce((s, n) => s + n, 0) / b.areas.length : null
    const avgYear = b.years.length ? Math.round(b.years.reduce((s, n) => s + n, 0) / b.years.length) : null
    return {
      city: b.city,
      district,
      city_code: b.city_code,
      calculated_for: today,
      unit_price_sqm_man: recent ? +(recent / 10000).toFixed(1) : null,
      unit_price_trend_3y: recent && old ? +(((recent / old) - 1) * 100).toFixed(1) : null,
      trade_count: b.count,
      unit_price_sqm_man_compact: compactRecent ? +(compactRecent / 10000).toFixed(1) : null,
      unit_price_trend_3y_compact: compactRecent && compactOld ? +(((compactRecent / compactOld) - 1) * 100).toFixed(1) : null,
      compact_count: b.compactCount,
      avg_area_sqm: avgArea ? +avgArea.toFixed(1) : null,
      avg_built_year: avgYear,
      detail: {
        recent_n: b.recent.length,
        old_n: b.old.length,
        compact_recent_n: b.compactRecent.length,
        compact_old_n: b.compactOld.length,
      },
      updated_at: new Date().toISOString(),
    }
  })

  for (let i = 0; i < rows.length; i += 200) {
    await sb('fudosan_district_scores?on_conflict=city,district,calculated_for', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: JSON.stringify(rows.slice(i, i + 200)),
    })
  }
}
