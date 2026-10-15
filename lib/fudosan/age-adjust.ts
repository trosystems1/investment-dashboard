/**
 * 築年を揃えたエリア別の㎡単価と上昇率。
 *
 * fudosan_area_stats の「10年」「直近3年」は、その期間に売れた部屋の㎡単価中央値の比較。
 * 売れる部屋が古くなった町では、場所の価値が上がっていても数字は下がって見える。
 * 例: 品川区旗の台は 10年 -18.4% と出るが、売れた部屋の築年数中央値が 13.5年 → 27年に
 * 伸びていただけで、築年と面積を揃えると +36% だった（2026-10-09 の分析）。
 *
 * やり方（ヘドニック補正）
 *   1. ln(㎡単価) を 築年数・築年数² と 面積帯（20/25/30㎡）で回帰する。
 *      係数は「エリア×成約年」ごとの平均を引いてから求める（固定効果）。
 *      これで「どの町・どの年か」の差を除いた、純粋な経年と面積の効きだけが残る。
 *   2. 1件ずつ「築15年・25㎡だったらいくらか」に換算する。
 *   3. 換算後の中央値を期間ごとに出し、エリア分析と同じ窓で比べる。
 *
 * このファイルは Next.js にも Supabase にも依存しない。単体で検算できるようにしておく。
 */

export type AdjTrade = {
  key: string          // 集計単位（"品川区|旗の台" など）
  year: number         // 成約年
  unitYen: number      // ㎡単価（円）
  areaSqm: number      // 専有面積（国交省は5㎡刻み）
  builtYear: number    // 建築年
}

export type AdjRow = {
  key: string
  unit_price_adj_man: number | null   // 直近窓の換算㎡単価（万円/㎡）
  trend_10y_adj: number | null        // 直近 ÷ 約10年前（%）
  trend_3y_adj: number | null         // 直近 ÷ その前3年（%）
  age_old: number | null              // 約10年前に売れた部屋の築年数中央値
  age_mid: number | null
  age_recent: number | null           // 直近に売れた部屋の築年数中央値
  n_old: number
  n_mid: number
  n_recent: number
}

export type AdjResult = {
  rows: AdjRow[]
  /** 築15年時点の経年による下落率（%/年）。マイナスが通常 */
  age_slope_pct_per_year: number
  n_used: number
  ref_age: number
  ref_area: number
}

/** エリア分析画面と同じ窓。ラベルもここに合わせる */
export const WINDOWS = {
  old: { from: 0, to: 2017, label: '2014–17' },
  mid: { from: 2021, to: 2023, label: '2021–23' },
  recent: { from: 2024, to: 9999, label: '2024–26' },
} as const

type Win = keyof typeof WINDOWS

/** 両側にこの件数があるときだけ上昇率を出す（エリア分析の既存ルールと同じ） */
export const MIN_N = 5

const REF_AGE = 15
const REF_AREA = 25
const MAX_AGE = 60

function windowOf(year: number): Win | null {
  for (const w of Object.keys(WINDOWS) as Win[]) {
    if (year >= WINDOWS[w].from && year <= WINDOWS[w].to) return w
  }
  return null
}

function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** 説明変数。基準（築15年・25㎡）でゼロになるように中心化しておく */
function features(age: number, area: number): number[] {
  return [
    age - REF_AGE,
    (age * age - REF_AGE * REF_AGE) / 100,
    (area >= 25 && area < 30 ? 1 : 0) - 1,   // 25㎡帯（基準）
    area >= 30 ? 1 : 0,                      // 30㎡帯
  ]
}

/** 小さな連立方程式（正規方程式）をガウスの消去法で解く */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    if (Math.abs(M[p][c]) < 1e-12) return null
    ;[M[c], M[p]] = [M[p], M[c]]
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = M[r][c] / M[c][c]
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  return M.map((row, i) => row[n] / row[i])
}

const pct = (a: number | null, b: number | null) =>
  a != null && b != null && b > 0 ? Math.round((a / b - 1) * 1000) / 10 : null

export function computeAgeAdjusted(trades: AdjTrade[]): AdjResult {
  // 使える行だけに絞る（築年不明・新築前の成約・極端な築古は除く）
  const rows = trades
    .map(t => ({ ...t, age: t.year - t.builtYear }))
    .filter(t => t.unitYen > 0 && Number.isFinite(t.age) && t.age >= 0 && t.age <= MAX_AGE)
    .map(t => ({ ...t, y: Math.log(t.unitYen), x: features(t.age, t.areaSqm), g: `${t.key}|${t.year}` }))

  // 1) エリア×成約年の平均を引く（固定効果）
  const K = 4
  const groups = new Map<string, { n: number; y: number; x: number[] }>()
  for (const r of rows) {
    const g = groups.get(r.g) ?? { n: 0, y: 0, x: Array(K).fill(0) }
    g.n += 1
    g.y += r.y
    for (let k = 0; k < K; k++) g.x[k] += r.x[k]
    groups.set(r.g, g)
  }
  const XtX = Array.from({ length: K }, () => Array(K).fill(0))
  const Xty = Array(K).fill(0)
  for (const r of rows) {
    const g = groups.get(r.g)!
    if (g.n < 2) continue
    const yd = r.y - g.y / g.n
    const xd = r.x.map((v, k) => v - g.x[k] / g.n)
    for (let i = 0; i < K; i++) {
      Xty[i] += xd[i] * yd
      for (let j = 0; j < K; j++) XtX[i][j] += xd[i] * xd[j]
    }
  }
  const beta = solve(XtX, Xty) ?? [0, 0, 0, 0]

  // 2) 1件ずつ「築15年・25㎡」に換算して、エリア×窓ごとに集める
  const byKey = new Map<string, Record<Win, { adj: number[]; age: number[] }>>()
  for (const r of rows) {
    const w = windowOf(r.year)
    if (!w) continue
    const fx = r.x.reduce((s, v, k) => s + v * beta[k], 0)
    const adj = Math.exp(r.y - fx)
    const b = byKey.get(r.key) ?? {
      old: { adj: [], age: [] }, mid: { adj: [], age: [] }, recent: { adj: [], age: [] },
    }
    b[w].adj.push(adj)
    b[w].age.push(r.age)
    byKey.set(r.key, b)
  }

  // 3) 窓ごとの中央値で比べる
  const out: AdjRow[] = []
  for (const [key, b] of byKey) {
    const ok = (w: Win) => b[w].adj.length >= MIN_N
    const med = (w: Win) => (ok(w) ? median(b[w].adj) : null)
    const ageMed = (w: Win) => {
      const m = median(b[w].age)
      return m == null ? null : Math.round(m * 10) / 10
    }
    const recent = med('recent')
    out.push({
      key,
      unit_price_adj_man: recent == null ? null : Math.round(recent / 1000) / 10,
      trend_10y_adj: pct(recent, med('old')),
      trend_3y_adj: pct(recent, med('mid')),
      age_old: ageMed('old'),
      age_mid: ageMed('mid'),
      age_recent: ageMed('recent'),
      n_old: b.old.adj.length,
      n_mid: b.mid.adj.length,
      n_recent: b.recent.adj.length,
    })
  }

  // 築15年時点の1年あたりの効き: d/dage = b1 + 2*b2*age/100
  const slope = beta[0] + (2 * beta[1] * REF_AGE) / 100
  return {
    rows: out,
    age_slope_pct_per_year: Math.round((Math.exp(slope) - 1) * 1000) / 10,
    n_used: rows.length,
    ref_age: REF_AGE,
    ref_area: REF_AREA,
  }
}
