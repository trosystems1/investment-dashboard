import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/fudosan/supabase'

// 国土交通省「不動産情報ライブラリ」XIT001 から城南4区の成約価格を取り込む。
// 毎月1日 03:00 UTC（vercel.json）。キーは https://www.reinfolib.mlit.go.jp/api/request/
// 正はここ。n8n「不動産_城南エリアデータ蓄積」のスケジュールは無効化すること。
//
// 使い方:
//   /api/cron/reinfolib                       直近12四半期（3年）＋スコア再計算
//   /api/cron/reinfolib?skip=12&quarters=12   3〜6年前（再計算なし）
//   /api/cron/reinfolib?quarters=0&recalc=1   取り込み済みデータだけでスコア再計算
//   XIT001 は 2005年まで遡れる。Hobby の60秒上限では quarters=12 が実用上の限界。
//
// 冪等性:
// 国交省は価格を有効数字、面積を5㎡刻みで丸めて公表する。
// 「同じ町丁目・四半期・価格・面積」の取引が複数あるのは正常なので、
// unique upsert は使わず (市区 × 年 × 四半期) で delete → insert する。

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
  CityPlanning?: string
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
  if (res.status === 404) return []
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

  const sp = new URL(req.url).searchParams
  const backQuarters = Number(sp.get('quarters') ?? 12)
  const skip = Number(sp.get('skip') ?? 0)
  const recalcParam = sp.get('recalc')
  const shouldRecalc = recalcParam === '1' || (recalcParam !== '0' && skip === 0 && backQuarters > 0)

  const now = new Date()
  const jobs: { year: number; quarter: number }[] = []
  let y = now.getFullYear()
  let q = Math.floor(now.getMonth() / 3) + 1

  for (let i = 0; i < skip; i++) {
    q -= 1
    if (q === 0) { q = 4; y -= 1 }
  }
  for (let i = 0; i < backQuarters; i++) {
    q -= 1
    if (q === 0) { q = 4; y -= 1 }
    if (y < 2005) break
    jobs.push({ year: y, quarter: q })
  }

  let fetched = 0
  let inserted = 0
  let deleted = 0
  const errors: string[] = []

  for (const city of CITIES) {
    for (const job of jobs) {
      try {
        const rows = await fetchTrades(city.code, job.year, job.quarter)
        const mansions = rows.filter(r => (r.Type ?? '').includes('マンション'))
        fetched += mansions.length

        // 未公表・空レスポンスでは既存を消さない（一時的な空応答で過去データを飛ばさない）
        if (!mansions.length) { await sleep(250); continue }

        const { error: delErr, count } = await sb(
          `fudosan_trades?city_code=eq.${city.code}&period_year=eq.${job.year}&period_quarter=eq.${job.quarter}`,
          { method: 'DELETE', prefer: 'return=minimal,count=exact' },
        )
        if (delErr) errors.push(`del ${city.name} ${job.year}Q${job.quarter}: ${delErr}`)
        else deleted += count ?? 0

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

        for (let i = 0; i < payload.length; i += 500) {
          const chunk = payload.slice(i, i + 500)
          const { error } = await sb('fudosan_trades', {
            method: 'POST',
            prefer: 'return=minimal',
            body: JSON.stringify(chunk),
          })
          if (error) errors.push(`ins ${city.name} ${job.year}Q${job.quarter}: ${error}`)
          else inserted += chunk.length
        }

        await sleep(400)
      } catch (e) {
        errors.push(String(e))
        await sleep(800)
      }
    }
  }

  if (shouldRecalc) {
    await recalcStationScores()
    await recalcDistrictScores()
  }

  const range = jobs.length
    ? `${jobs[jobs.length - 1].year}Q${jobs[jobs.length - 1].quarter} 〜 ${jobs[0].year}Q${jobs[0].quarter}`
    : 'none'

  return NextResponse.json({
    ok: true,
    range,
    quarters: jobs.length,
    fetched,
    deleted,
    inserted,
    recalc: shouldRecalc,
    errors: errors.slice(0, 20),
  })
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
