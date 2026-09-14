import { NextRequest, NextResponse } from 'next/server'
import { evaluate, type Property } from '@/lib/fudosan/score'
import { loadMarketContext } from '@/lib/fudosan/market'
import { CRITERIA_VERSION } from '@/lib/fudosan/criteria'
import { sb } from '@/lib/fudosan/supabase'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * 保存済みの物件を、いまのクライテリアで一括再判定する。
 *
 * 一覧画面は fudosan_latest（＝物件ごとに最新の evaluation を引くビュー）を読むので、
 * クライテリアを変えても再判定を流すまで画面は古い判定のままになる。
 * v2.1 → v2.2 のように閾値を動かしたら必ずここを叩くこと。
 *
 * 既存の evaluation は消さずに追記する。criteria_version 別に残るので、
 * 「どの版で何件Aだったか」を後から比較できる。
 */
/** __name は失敗行を特定するための内部用。Supabase へ送る前に落とす。 */
function stripInternal(row: Record<string, unknown>): Record<string, unknown> {
  const { __name: _drop, ...rest } = row
  return rest
}

type Row = {
  id: string
  raw_json: Property | null
  name: string | null
  verdict: string | null
  score: number | null
  criteria_version: string | null
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-ingest-secret')
  if (!secret || secret !== process.env.FUDOSAN_INGEST_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 200)
  const offset = Number(req.nextUrl.searchParams.get('offset') ?? 0)
  const dryRun = req.nextUrl.searchParams.get('dry') === '1'

  const { data: rows, error } = await sb<Row[]>(
    `fudosan_latest?select=id,raw_json,name,verdict,score,criteria_version&order=created_at.desc&limit=${limit}&offset=${offset}`,
  )
  if (error || !rows) {
    return NextResponse.json({ ok: false, error: error ?? 'fetch failed' }, { status: 500 })
  }

  const before: Record<string, number> = {}
  const after: Record<string, number> = {}
  const changed: Array<{ name: string | null; from: string | null; to: string; score: number | null }> = []
  const evaluations: Record<string, unknown>[] = []

  for (const row of rows) {
    const p = row.raw_json
    before[row.verdict ?? 'なし'] = (before[row.verdict ?? 'なし'] ?? 0) + 1
    if (!p || typeof p !== 'object') {
      after['スキップ'] = (after['スキップ'] ?? 0) + 1
      continue
    }

    const market = await loadMarketContext(p)
    const e = evaluate(p, market)
    after[e.verdict] = (after[e.verdict] ?? 0) + 1

    if (e.verdict !== row.verdict) {
      changed.push({ name: row.name, from: row.verdict, to: e.verdict, score: e.score })
    }

    evaluations.push({
      __name: row.name,
      property_id: row.id,
      criteria_version: CRITERIA_VERSION,
      verdict: e.verdict,
      score: e.score,
      metrics: e.metrics,
      ng_reasons: e.ng_reasons,
      gate2_fails: e.gate2_fails,
      gate3_fails: e.gate3_fails,
      gate4_fails: e.gate4_fails,
      warnings: e.warnings,
      bonuses: e.bonuses,
      todo: e.todo,
      market_context: e.market_context,
    })
  }

  // Supabase は27件を1リクエストで挿入すると Bad Gateway を返した。
  // 小さく刻んで入れ、塊が落ちたら1件ずつ入れ直す。
  // 1件も通らなかった行だけ failures に残し、残りは進める。
  // 全部止めてしまうと、どの行が原因か分からないまま何も反映されない。
  const CHUNK = 5
  const failures: Array<{ property_id: string; name: string | null; error: string }> = []
  let inserted = 0

  if (!dryRun) {
    for (let i = 0; i < evaluations.length; i += CHUNK) {
      const chunk = evaluations.slice(i, i + CHUNK)
      const { error: chunkErr } = await sb('fudosan_evaluations', {
        method: 'POST',
        prefer: 'return=minimal',
        body: JSON.stringify(chunk.map(stripInternal)),
      })
      if (!chunkErr) {
        inserted += chunk.length
        continue
      }
      for (const row of chunk) {
        const { error: rowErr } = await sb('fudosan_evaluations', {
          method: 'POST',
          prefer: 'return=minimal',
          body: JSON.stringify([stripInternal(row)]),
        })
        if (rowErr) {
          failures.push({
            property_id: String(row.property_id),
            name: String(row.__name ?? ''),
            error: String(rowErr).slice(0, 300),
          })
        } else {
          inserted += 1
        }
      }
    }
  }

  return NextResponse.json({
    ok: failures.length === 0,
    dry_run: dryRun,
    criteria_version: CRITERIA_VERSION,
    total: rows.length,
    inserted,
    failed: failures.length,
    failures: failures.slice(0, 5),
    before,
    after,
    changed,
  })
}
