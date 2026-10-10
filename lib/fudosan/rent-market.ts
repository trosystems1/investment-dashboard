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
// 在庫平均は2023年10月時点で入居中の契約で、いまの募集賃料より低い。
// 判定に使うのは、criteria.ts の CONFIG.rent で掛けた募集相当。
//   在庫円 × 新規契約比 × 調査月からのCPI × 募集構成プレミアム
// 新規契約比は第111-1表（特別区部・6.0〜11.9畳）の直近入居÷総数で、ほぼ1。
// CPIは東京都区部・民営家賃（非木造）の2023-10から2026-09。この2つだけでは約+6%で、
// 12万円はまだ全区で1.15倍を超える。残差は駅近1Kの募集と、区内すべての29㎡以下在庫の
// 構成差なので、2026年10月の募集平均に対する残差の中央値を1係数にした。
// 在庫の円額は残し、係数は読むときに掛け直す。rent_basis='asking' の行は観測済みの
// 募集賃料なので、もう掛けない。

import { CONFIG } from './criteria'
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

/** 想定賃料 / 募集相当 がこの倍を超えると -10。定義は CONFIG.rent.aboveMarket。 */
export const RENT_ABOVE_MARKET = CONFIG.rent.aboveMarket

export type RentBasis = 'stock' | 'asking'

/** CPIの時点。募集構成プレミアムの当てはめは2026年10月。 */
export const RENT_CORRECTION_AS_OF = CONFIG.rent.cpiAsOf

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

/** 在庫 → 募集相当の係数。小数第7位で丸めて、SQLのスナップショットと揃える。 */
export function rentCorrectionFactor(): number {
  const { newContractRatio, cpiSinceSurvey, askingMixPremium } = CONFIG.rent
  return Math.round(newContractRatio * cpiSinceSurvey * askingMixPremium * 1e7) / 1e7
}

export function askingFromStockYen(stockYen: number): { askingYen: number; askingMan: number; factor: number } {
  const factor = rentCorrectionFactor()
  const askingYen = Math.round(stockYen * factor)
  return { askingYen, askingMan: yenToMan(askingYen), factor }
}

export function correctionNote(): string {
  const r = CONFIG.rent
  return `在庫平均×新規契約比${r.newContractRatio}（第111-1表 特別区部・居住室6.0〜11.9畳・2021年〜2023年9月入居73,603円÷入居時期総数73,036円）×CPI${r.cpiSinceSurvey}（東京都区部・民営家賃（非木造）2026-09の102.6÷2023-10の97.6）×募集構成${r.askingMixPremium}（2026-10 HOME'S 徒歩10分以内1Kの区平均残差の中央値）`
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
  rent_basis: RentBasis
  rent_asking_man: number | null
  rent_asking_yen: number | null
}

export type RentPick = {
  level: RentLevel
  /** 判定に使う募集相当（万円/月）。basis=asking のときは観測値。 */
  rent_1k_man: number
  rent_1k_yen: number | null
  /** 調査の在庫平均。観測済みの募集賃料だけで在庫が無いときは null。 */
  rent_stock_man: number | null
  rent_stock_yen: number | null
  rent_basis: RentBasis
  correction_factor: number | null
  correction_as_of: string | null
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
    rent_basis: raw.rent_basis === 'asking' ? 'asking' : 'stock',
    rent_asking_man: toNum(raw.rent_asking_man),
    rent_asking_yen: toNum(raw.rent_asking_yen),
  }
}

function scoringFromRow(row: RentMarketRow, scope: string): RentPick {
  const base = {
    level: row.level,
    scope_label: scope,
    source: row.source,
    as_of: row.as_of,
    segment: row.segment,
    sample_n: row.sample_n,
  }
  if (row.rent_basis === 'asking') {
    const askingMan = row.rent_asking_man ?? row.rent_1k_man
    const askingYen = row.rent_asking_yen ?? (row.rent_asking_man == null ? row.rent_1k_yen : null)
    const hasSeparateStock = row.rent_asking_man != null && row.rent_1k_man !== row.rent_asking_man
    return {
      ...base,
      rent_1k_man: askingMan,
      rent_1k_yen: askingYen,
      rent_stock_man: hasSeparateStock ? row.rent_1k_man : null,
      rent_stock_yen: hasSeparateStock ? row.rent_1k_yen : null,
      rent_basis: 'asking',
      correction_factor: null,
      correction_as_of: null,
    }
  }
  const stockYen = row.rent_1k_yen ?? Math.round(row.rent_1k_man * 10000)
  const corrected = askingFromStockYen(stockYen)
  return {
    ...base,
    rent_1k_man: corrected.askingMan,
    rent_1k_yen: corrected.askingYen,
    rent_stock_man: row.rent_1k_yen != null ? yenToMan(row.rent_1k_yen) : row.rent_1k_man,
    rent_stock_yen: stockYen,
    rent_basis: 'stock',
    correction_factor: corrected.factor,
    correction_as_of: RENT_CORRECTION_AS_OF,
  }
}

function findRow(rows: RentMarketRow[], level: RentLevel, city: string, district: string): RentMarketRow | null {
  return rows.find(r => r.level === level && r.city === city && r.district === district && r.rent_1k_man > 0) ?? null
}

/** DBの行だけを見る。当たらなければ null（同梱の区平均には落とさない）。値は補正前。 */
export function pickRentMarket(
  rows: RentMarketRow[],
  city: string,
  district: string | null,
  area: string | null,
): RentMarketRow | null {
  if (district) {
    const town = findRow(rows, 'town', city, district)
    if (town) return town
  }
  if (area) {
    const hit = findRow(rows, 'area', city, area)
    if (hit) return hit
  }
  return findRow(rows, 'city', city, '')
}

function scopeFor(row: RentMarketRow): string {
  if (row.level === 'town') return `${row.city}${row.district}（町名）`
  if (row.level === 'area') return `${row.city}${row.district}エリア（駅圏）`
  return `${row.city}（区）`
}

function embeddedRow(city: string): RentMarketRow | null {
  const ward = JONAN_RENT_1K.find(w => w.city === city)
  if (!ward) return null
  return {
    level: 'city',
    city,
    district: '',
    rent_1k_man: yenToMan(ward.rent_1k_yen),
    rent_1k_yen: ward.rent_1k_yen,
    sample_n: ward.sample_n,
    source: RENT_SOURCE,
    as_of: RENT_AS_OF,
    segment: RENT_SEGMENT,
    rent_basis: 'stock',
    rent_asking_man: null,
    rent_asking_yen: null,
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
  const row = pickRentMarket(rows, city, district, area) ?? embeddedRow(city)
  return row ? scoringFromRow(row, scopeFor(row)) : null
}

/** 町名の行が無いときだけ、駅圏の行を引くために areaOf が要る。 */
export function rentNeedsAreaLookup(rows: RentMarketRow[], city: string, district: string | null): boolean {
  if (!district) return false
  if (findRow(rows, 'town', city, district)) return false
  return rows.some(r => r.level === 'area' && r.city === city && r.rent_1k_man > 0)
}

export function formatRentMarketNote(rent: {
  rent_1k_man: number
  scope_label: string
  as_of: string
  segment: string
  sample_n: number | null
  rent_stock_man?: number | null
  rent_basis?: RentBasis | null
  correction_factor?: number | null
  correction_as_of?: string | null
}): string {
  const n = rent.sample_n != null ? `・約${rent.sample_n.toLocaleString('ja-JP')}戸` : ''
  if (rent.rent_basis === 'asking' || rent.rent_stock_man == null) {
    return `1K相場 ${rent.rent_1k_man}万円/月（${rent.scope_label}・${rent.as_of}・募集の観測値${n}）`
  }
  const r = CONFIG.rent
  const factor = rent.correction_factor != null ? rent.correction_factor.toFixed(3) : '—'
  const asOf = rent.correction_as_of ?? r.cpiAsOf
  return `1K相場 ${rent.rent_1k_man}万円/月（${rent.scope_label}・募集相当・補正${asOf}・×${factor}＝新規契約${r.newContractRatio}×CPI${r.cpiSinceSurvey}×募集構成${r.askingMixPremium.toFixed(2)}）。在庫平均 ${rent.rent_stock_man}万円（${rent.as_of}・${rent.segment}${n}）`
}

const RENT_SELECT_BASE = 'level,city,district,rent_1k_man,rent_1k_yen,sample_n,source,as_of,segment'
const RENT_SELECT = `${RENT_SELECT_BASE},rent_basis,rent_asking_man,rent_asking_yen`

function rowsFrom(data: Record<string, unknown>[] | null): RentMarketRow[] {
  return (data ?? []).flatMap(raw => {
    const row = normalizeRentRow(raw)
    return row ? [row] : []
  })
}

export async function fetchRentRows(): Promise<RentMarketRow[]> {
  if (!supabaseConfig()) return []
  try {
    const full = await sb<Record<string, unknown>[]>(
      `fudosan_rent_market?select=${RENT_SELECT}&limit=2000`,
    )
    if (!full.error) return rowsFrom(full.data)
    // 補正列を足す前のテーブルでも、在庫の円額から募集相当は計算できる。
    console.error('[fudosan/rent] lookup with correction columns failed', full.error)
    const base = await sb<Record<string, unknown>[]>(
      `fudosan_rent_market?select=${RENT_SELECT_BASE}&limit=2000`,
    )
    if (base.error) {
      console.error('[fudosan/rent] lookup failed', base.error)
      return []
    }
    return rowsFrom(base.data)
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
