import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/fudosan/supabase'
import {
  JONAN_RENT_1K, RENT_AS_OF, RENT_PUBLISHED_AT, RENT_SEGMENT, RENT_SOURCE,
  RENT_STATS_DATA_ID, parseEstatRentPayload, yenToMan,
} from '@/lib/fudosan/rent-market'

// 令和5年住宅・土地統計調査の1K相場（区）を取り直す。
// 調査は5年ごとで、次回の公表まで数字はほぼ動かない。四半期に1回、
// 公表値の訂正とアプリIDの疎通だけを見る。町名・駅圏の行は触らない。
//
// ESTAT_APP_ID が無いときは何もしない（scripts/fudosan-rent-market.sql の値が残る）。
// キーは https://www.e-stat.go.jp/api/ で発行する。

export const runtime = 'nodejs'
export const maxDuration = 60

const API = 'https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-vercel-cron')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}` && cronHeader !== '1') {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const appId = process.env.ESTAT_APP_ID
  if (!appId) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'ESTAT_APP_ID not set' })
  }

  const areas = JONAN_RENT_1K.map(w => w.code).join(',')
  const url = `${API}?appId=${encodeURIComponent(appId)}&statsDataId=${RENT_STATS_DATA_ID}&cdArea=${areas}&metaGetFlg=Y`
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: `e-Stat HTTP ${res.status}` }, { status: 502 })
  }
  const body = await res.json()
  const status = body?.GET_STATS_DATA?.RESULT?.STATUS
  if (status !== 0 && status !== '0') {
    const msg = body?.GET_STATS_DATA?.RESULT?.ERROR_MSG ?? `e-Stat status ${status}`
    return NextResponse.json({ ok: false, error: String(msg).slice(0, 300) }, { status: 502 })
  }

  const parsed = parseEstatRentPayload(body)
  if (!parsed.length) {
    return NextResponse.json({
      ok: false,
      error: 'e-Statの応答から城南4区の29㎡以下・非木造・家賃0円を含まない平均を読めなかった',
    }, { status: 502 })
  }

  const now = new Date().toISOString()
  const payload = parsed.map(r => ({
    level: 'city',
    city: r.city,
    district: '',
    rent_1k_yen: r.rent_1k_yen,
    rent_1k_man: yenToMan(r.rent_1k_yen),
    source: RENT_SOURCE,
    as_of: RENT_AS_OF,
    published_at: RENT_PUBLISHED_AT,
    segment: RENT_SEGMENT,
    stats_id: RENT_STATS_DATA_ID,
    note: '抽出調査の在庫平均。募集賃料ではない。e-Statから更新。',
    updated_at: now,
  }))

  const { error } = await sb('fudosan_rent_market?on_conflict=level,city,district', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: JSON.stringify(payload),
  })
  if (error) {
    return NextResponse.json({ ok: false, error: error.slice(0, 300) }, { status: 502 })
  }

  return NextResponse.json({
    ok: true,
    updated: payload.map(r => ({ city: r.city, rent_1k_yen: r.rent_1k_yen, rent_1k_man: r.rent_1k_man })),
  })
}
