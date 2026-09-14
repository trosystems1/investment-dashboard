import { sb, supabaseConfig } from './supabase'

export type FudosanLatestRow = {
  id: string
  name: string | null
  price_man: number | null
  rent_man: number | null
  area_sqm: number | null
  built_ym: string | null
  city: string | null
  address: string | null
  line: string | null
  station: string | null
  walk_min: number | null
  drive_link: string | null
  verdict: string | null
  score: number | null
  criteria_version: string | null
  metrics: Record<string, unknown> | null
  ng_reasons: string[] | null
  gate2_fails: string[] | null
  gate3_fails: string[] | null
  gate4_fails: string[] | null
  warnings: Array<{ tag: string; pt: number }> | null
  todo: string[] | null
  market_context: Record<string, unknown> | null
  evaluated_at: string | null
  created_at: string
}

const LIST_SELECT = [
  'id', 'name', 'price_man', 'rent_man', 'area_sqm', 'built_ym', 'city',
  'address', 'line', 'station', 'walk_min', 'drive_link', 'verdict', 'score',
  'criteria_version', 'metrics', 'ng_reasons', 'gate2_fails', 'gate3_fails', 'gate4_fails',
  'warnings', 'todo',
  'market_context', 'evaluated_at', 'created_at',
].join(',')

/** ビューに gate 列を足す SQL（scripts/fudosan-rescore-view.sql）をまだ流していない環境向け */
const LEGACY_SELECT = LIST_SELECT.split(',')
  .filter(c => !c.startsWith('gate'))
  .join(',')

export async function listLatestProperties(limit = 200): Promise<{
  rows: FudosanLatestRow[]
  configured: boolean
}> {
  if (!supabaseConfig()) return { rows: [], configured: false }
  const { data, error } = await sb<FudosanLatestRow[]>(
    `fudosan_latest?select=${LIST_SELECT}&order=created_at.desc&limit=${limit}`,
  )
  if (!error) return { rows: data ?? [], configured: true }

  // gate2_fails などはビューに後から足した列。SQLをまだ流していない環境では
  // 列が無くて400になる。そこで画面を白紙にせず、旧い列だけで読み直す。
  console.error('[fudosan] list failed, retrying without gate columns', error)
  const { data: fallback, error: fallbackErr } = await sb<FudosanLatestRow[]>(
    `fudosan_latest?select=${LEGACY_SELECT}&order=created_at.desc&limit=${limit}`,
  )
  if (fallbackErr) {
    console.error('[fudosan] list failed', fallbackErr)
    return { rows: [], configured: true }
  }
  return { rows: fallback ?? [], configured: true }
}

export async function getLatestProperty(id: string): Promise<FudosanLatestRow | null> {
  if (!supabaseConfig()) return null
  const { data, error } = await sb<FudosanLatestRow[]>(
    `fudosan_latest?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,
  )
  if (error) {
    console.error('[fudosan] get failed', error)
    return null
  }
  return data?.[0] ?? null
}
