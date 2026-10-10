// 城南4区の1K（小規模住戸）賃料相場。
//
// 国土交通省 不動産情報ライブラリの公開API（XIT001 ほか）に賃料の項目はない。
// 売買成約から利回りを逆算すると、判定がすでに使っている表面利回りと循環するので使わない。
// ポータルの巡回・スクレイピングはプロジェクトの方針でしない。
//
// 採用したのは総務省「住宅・土地統計調査」（e-Stat）の市区町村別・在庫平均。
// 5年に1度の抽出調査で、次回（2028年調査）の公表まで値はほぼ動かない。
// 最小公表単位は区で、町丁目・駅圏の数字は調査に存在しない。
// テーブルには town / area の行も置ける。引き当ては 町名 → 駅圏 → 区 の順で、
// 区の行（または下記の同梱値）が最終フォールバックになる。
//
// 数字は令和5年調査・基本集計 第130表（Excel statInfId=000040210078、
// 2024-09-25公表）の次のセル。家賃は円、戸数は表章された住宅数。
//   民営借家（専用住宅）× 共同住宅（非木造）× 延べ面積29㎡以下 × 家賃0円を含まない平均
// 区分ワンルームの延べ面積（内法に近い）はほぼこの帯に入る。
// 30〜49㎡帯は1LDKを含むので1K相場には使わない。
//
// 限界: これは2023年10月時点で入居中の契約の平均で、いまの募集賃料ではない。
// 古い契約が平均を下に引っ張る。想定賃料がこの平均の1.15倍を超えると減点するが、
// 城南の目標賃料（月12万円）は4区ともその線を超える。

import { sb, supabaseConfig } from './supabase'

export const RENT_SEGMENT =
  '民営借家（専用住宅）・共同住宅（非木造）・延べ面積29㎡以下・家賃0円を含まない平均'

export const RENT_SOURCE = 'e-Stat 令和5年住宅・土地統計調査 基本集計 第130表'

/** 調査の基準日（令和5年10月1日） */
export const RENT_AS_OF = '2023-10-01'

export const RENT_PUBLISHED_AT = '2024-09-25'

/** 表130-2（平均のみ）の統計表表示ID。更新cronはこちらを叩く。 */
export const RENT_STATS_DATA_ID = '0004021532'

/** 戸数と平均の両方を含む Excel 第130表。 */
export const RENT_STAT_INF_ID = '000040210078'

export const RENT_ABOVE_MARKET = 1.15

type CensusWard = { city: string; code: string; rent_1k_yen: number; sample_n: number }

/** 第130表から転記。rent_1k_man は yenToMan で出すので、ここには円だけ置く。 */
export const JONAN_RENT_1K: CensusWard[] = [
  { city: '品川区', code: '13109', rent_1k_yen: 81353, sample_n: 49650 },
  { city: '目黒区', code: '13110', rent_1k_yen: 85375, sample_n: 24540 },
  { city: '大田区', code: '13111', rent_1k_yen: 71628, sample_n: 73140 },
  { city: '世田谷区', code: '13112', rent_1k_yen: 75381, sample_n: 75070 },
]

const WARD_BY_CODE = new Map(JONAN_RENT_1K.map(w => [w.code, w.city]))

export function yenToMan(yen: number): number {
  return Math.round((yen / 10000) * 100) / 100
}

export type RentLevel = 'town' | 'area' | 'city'

export type RentMarketRow = {
  level: RentLevel
  city: string
  district: string
  rent_1k_man: number
  rent_1k_yen: number | null
  sample_n: number | null
  source: string
  as_of: string
  segment: string
}

export type RentPick = {
  level: RentLevel
  rent_1k_man: number
  rent_1k_yen: number | null
  scope_label: string
  source: string
  as_of: string
  segment: string
  sample_n: number | null
}

const toNum = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return null
}

export function normalizeRentRow(raw: Record<string, unknown>): RentMarketRow | null {
  const level = raw.level
  if (level !== 'town' && level !== 'area' && level !== 'city') return null
  const city = typeof raw.city === 'string' ? raw.city : ''
  const man = toNum(raw.rent_1k_man)
  if (!city || man == null || man <= 0) return null
  const sample = toNum(raw.sample_n)
  return {
    level,
    city,
    district: typeof raw.district === 'string' ? raw.district : '',
    rent_1k_man: man,
    rent_1k_yen: toNum(raw.rent_1k_yen),
    sample_n: sample == null ? null : Math.round(sample),
    source: typeof raw.source === 'string' && raw.source ? raw.source : RENT_SOURCE,
    as_of: typeof raw.as_of === 'string' && raw.as_of ? raw.as_of.slice(0, 10) : RENT_AS_OF,
    segment: typeof raw.segment === 'string' && raw.segment ? raw.segment : RENT_SEGMENT,
  }
}

function rowPick(row: RentMarketRow, scope: string): RentPick {
  return {
    level: row.level,
    rent_1k_man: row.rent_1k_man,
    rent_1k_yen: row.rent_1k_yen,
    scope_label: scope,
    source: row.source,
    as_of: row.as_of,
    segment: row.segment,
    sample_n: row.sample_n,
  }
}

function findRow(rows: RentMarketRow[], level: RentLevel, city: string, district: string): RentMarketRow | null {
  return rows.find(r => r.level === level && r.city === city && r.district === district && r.rent_1k_man > 0) ?? null
}

/** DBの行だけを見る。当たらなければ null（同梱の区平均には落とさない）。 */
export function pickRentMarket(
  rows: RentMarketRow[],
  city: string,
  district: string | null,
  area: string | null,
): RentPick | null {
  if (district) {
    const town = findRow(rows, 'town', city, district)
    if (town) return rowPick(town, `${city}${district}（町名）`)
  }
  if (area) {
    const hit = findRow(rows, 'area', city, area)
    if (hit) return rowPick(hit, `${city}${area}エリア（駅圏）`)
  }
  const cityRow = findRow(rows, 'city', city, '')
  if (cityRow) return rowPick(cityRow, `${city}（区）`)
  return null
}

function embeddedCity(city: string): RentPick | null {
  const ward = JONAN_RENT_1K.find(w => w.city === city)
  if (!ward) return null
  return {
    level: 'city',
    rent_1k_man: yenToMan(ward.rent_1k_yen),
    rent_1k_yen: ward.rent_1k_yen,
    scope_label: `${city}（区）`,
    source: RENT_SOURCE,
    as_of: RENT_AS_OF,
    segment: RENT_SEGMENT,
    sample_n: ward.sample_n,
  }
}

/**
 * 町名 → 駅圏 → 区（DB）→ 区（同梱の調査値）。
 * テーブル未作成でも城南4区は区の調査値まで落ちる。
 */
export function resolveRentMarket(
  rows: RentMarketRow[],
  city: string,
  district: string | null,
  area: string | null,
): RentPick | null {
  return pickRentMarket(rows, city, district, area) ?? embeddedCity(city)
}

/** 町名の行が無いときだけ、駅圏の行を引くために areaOf が要る。 */
export function rentNeedsAreaLookup(rows: RentMarketRow[], city: string, district: string | null): boolean {
  if (!district) return false
  if (findRow(rows, 'town', city, district)) return false
  return rows.some(r => r.level === 'area' && r.city === city && r.rent_1k_man > 0)
}

export function formatRentMarketNote(rent: Pick<RentPick, 'rent_1k_man' | 'scope_label' | 'as_of' | 'segment' | 'sample_n'>): string {
  const n = rent.sample_n != null ? `・約${rent.sample_n.toLocaleString('ja-JP')}戸` : ''
  return `1K相場 ${rent.rent_1k_man}万円/月（${rent.scope_label}・${rent.as_of}・${rent.segment}${n}）。抽出調査の在庫平均で、いまの募集賃料より低いことがある`
}

export async function fetchRentRows(): Promise<RentMarketRow[]> {
  if (!supabaseConfig()) return []
  try {
    const { data, error } = await sb<Record<string, unknown>[]>(
      'fudosan_rent_market?select=level,city,district,rent_1k_man,rent_1k_yen,sample_n,source,as_of,segment&limit=2000',
    )
    if (error) {
      console.error('[fudosan/rent] lookup failed', error)
      return []
    }
    return (data ?? []).flatMap(raw => {
      const row = normalizeRentRow(raw)
      return row ? [row] : []
    })
  } catch (e) {
    console.error('[fudosan/rent] lookup threw', e)
    return []
  }
}

type EstatClass = { '@code'?: string; '@name'?: string }
type EstatDim = { '@id'?: string; '@name'?: string; CLASS?: EstatClass | EstatClass[] }
type EstatValue = Record<string, string | number | undefined>

function asArray<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return []
  return Array.isArray(v) ? v : [v]
}

function dimAttr(row: EstatValue, dimId: string): string | null {
  const v = row[`@${dimId}`] ?? row[dimId]
  return v == null || v === '' ? null : String(v)
}

/**
 * e-Stat getStatsData（表130-2）から城南4区の1K相場を取り出す。
 * 分類コードは表の版で変わりうるので、コード番号ではなく項目名で選ぶ。
 */
export function parseEstatRentPayload(body: unknown): Array<{ city: string; code: string; rent_1k_yen: number }> {
  const root = body as {
    GET_STATS_DATA?: { STATISTICAL_DATA?: { CLASS_INF?: { CLASS_OBJ?: EstatDim | EstatDim[] }; DATA_INF?: { VALUE?: EstatValue | EstatValue[] } } }
    STATISTICAL_DATA?: { CLASS_INF?: { CLASS_OBJ?: EstatDim | EstatDim[] }; DATA_INF?: { VALUE?: EstatValue | EstatValue[] } }
  }
  const data = root?.GET_STATS_DATA?.STATISTICAL_DATA ?? root?.STATISTICAL_DATA
  if (!data) return []

  const dims = asArray(data.CLASS_INF?.CLASS_OBJ).map(d => ({
    id: String(d['@id'] ?? ''),
    name: String(d['@name'] ?? ''),
    codes: asArray(d.CLASS).map(c => ({ code: String(c['@code'] ?? ''), name: String(c['@name'] ?? '') })),
  })).filter(d => d.id)

  const find = (pred: (dimName: string, codeName: string) => boolean, prefer?: (codeName: string) => boolean) => {
    const hits: Array<{ dimId: string; code: string; name: string }> = []
    for (const dim of dims) {
      for (const c of dim.codes) {
        if (c.code && pred(dim.name, c.name)) hits.push({ dimId: dim.id, code: c.code, name: c.name })
      }
    }
    if (!hits.length) return null
    const best = (prefer && hits.find(h => prefer(h.name))) || hits[0]
    return { dimId: best.dimId, code: best.code }
  }

  const structure = find((_, code) => code.includes('非木造'), code => code.includes('共同'))
  const small = find((dim, code) => dim.includes('延べ面積') && /29/.test(code) && /以下|未満/.test(code))
  const exclZero = find((_, code) => code.includes('含まない'))
  if (!structure || !small || !exclZero) return []

  const out: Array<{ city: string; code: string; rent_1k_yen: number }> = []
  for (const row of asArray(data.DATA_INF?.VALUE)) {
    if (dimAttr(row, structure.dimId) !== structure.code) continue
    if (dimAttr(row, small.dimId) !== small.code) continue
    if (dimAttr(row, exclZero.dimId) !== exclZero.code) continue
    const area = dimAttr(row, 'area')
    const city = area ? WARD_BY_CODE.get(area) : undefined
    if (!area || !city) continue
    const yen = toNum(row.$)
    if (yen == null || yen < 20000 || yen > 300000) continue
    out.push({ city, code: area, rent_1k_yen: Math.round(yen) })
  }
  return out
}
