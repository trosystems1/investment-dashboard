import { NextRequest, NextResponse } from 'next/server'
import { evaluate, toMessage, type Property } from '@/lib/fudosan/score'
import { loadMarketContext } from '@/lib/fudosan/market'
import { CRITERIA_VERSION } from '@/lib/fudosan/criteria'
import { sb } from '@/lib/fudosan/supabase'

export const runtime = 'nodejs'
export const maxDuration = 60

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://investment-dashboard-ruby.vercel.app'

function dedupeKey(p: Property, fileId?: string): string {
  const parts = [p.name ?? '', p.price_man ?? '', p.area_sqm ?? '', p.address ?? ''].join('|')
  return parts.replace(/\s+/g, '') || `file:${fileId ?? Math.random()}`
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-ingest-secret')
  if (!secret || secret !== process.env.FUDOSAN_INGEST_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  let body: {
    source?: string
    file_id?: string
    file_name?: string
    drive_link?: string
    raw_text?: string
    parse_error?: string | null
    property?: Property
    equity_man?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })
  }

  const p = body.property ?? {}
  const market = await loadMarketContext(p)
  const evaluation = evaluate(p, market, body.equity_man)
  const message = toMessage(p, evaluation)
  const key = dedupeKey(p, body.file_id)

  const { data: props, error: pErr } = await sb<Array<{ id: string }>>(
    'fudosan_properties?on_conflict=dedupe_key',
    {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: JSON.stringify({
        source: body.source ?? 'unknown',
        source_ref: body.file_id ?? null,
        file_name: body.file_name ?? null,
        drive_link: body.drive_link ?? null,
        dedupe_key: key,
        name: p.name ?? null,
        price_man: p.price_man ?? null,
        rent_man: p.rent_man ?? null,
        area_sqm: p.area_sqm ?? null,
        area_basis: p.area_basis ?? null,
        registered_sqm: p.registered_sqm ?? null,
        floor_plan: (p as Record<string, unknown>).floor_plan ?? null,
        management_fee_yen: p.management_fee_yen ?? null,
        repair_reserve_yen: p.repair_reserve_yen ?? null,
        other_monthly_yen: p.other_monthly_yen ?? null,
        built_ym: p.built_ym ?? null,
        structure: (p as Record<string, unknown>).structure ?? null,
        address: p.address ?? null,
        city: p.city ?? null,
        line: p.line ?? null,
        station: p.station ?? null,
        walk_min: p.walk_min ?? null,
        floor: p.floor ?? null,
        total_floors: p.total_floors ?? null,
        total_units: p.total_units ?? null,
        facing: p.facing ?? null,
        zoning: p.zoning ?? null,
        land_right: p.land_right ?? null,
        management_type: p.management_type ?? null,
        manager_type: p.manager_type ?? null,
        occupancy: p.occupancy ?? null,
        sublease: p.sublease ?? null,
        repair_method: p.repair_method ?? null,
        raw_text: body.raw_text ?? null,
        raw_json: p as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      }),
    },
  )

  const prop = props?.[0]
  if (pErr || !prop) {
    return NextResponse.json(
      { ok: false, error: pErr ?? 'insert failed', verdict: 'ERROR', message },
      { status: 500 },
    )
  }

  const { error: eErr } = await sb('fudosan_evaluations', {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify({
      property_id: prop.id,
      criteria_version: CRITERIA_VERSION,
      verdict: evaluation.verdict,
      score: evaluation.score,
      metrics: evaluation.metrics,
      ng_reasons: evaluation.ng_reasons,
      gate2_fails: evaluation.gate2_fails,
      gate3_fails: evaluation.gate3_fails,
      gate4_fails: evaluation.gate4_fails,
      warnings: evaluation.warnings,
      bonuses: evaluation.bonuses,
      todo: evaluation.todo,
      market_context: evaluation.market_context,
    }),
  })
  if (eErr) console.error('[fudosan] evaluation insert failed', eErr)

  await sb('fudosan_decisions', {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify({
      property_id: prop.id,
      action: '通知',
      memo: `自動診断 ${evaluation.verdict} / score ${evaluation.score}`,
    }),
  })

  return NextResponse.json({
    ok: true,
    property_id: prop.id,
    verdict: evaluation.verdict,
    score: evaluation.score,
    message,
    dashboard_url: `${BASE_URL}/fudosan/${prop.id}`,
    criteria_version: CRITERIA_VERSION,
    market_context: evaluation.market_context,
  })
}
