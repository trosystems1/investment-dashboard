import Link from 'next/link'
import { sb, supabaseConfig } from '@/lib/fudosan/supabase'
import AreaExplorer, { type Area } from '@/components/fudosan/AreaExplorer'
import { WARD_AKIYA_LIST, TOKUBETSU_KUBU, AKIYA_YEARS, AKIYA_FLAT_PT, type WardAkiya } from '@/lib/fudosan/ward-akiya'

export const revalidate = 60

const GOLD = '#C8A96A'
const INK = '#E8E4D9'
const MUTED = 'rgba(232,228,217,0.55)'
const FAINT = 'rgba(232,228,217,0.32)'
const CARD = 'rgba(255,255,255,0.03)'
const LINE = 'rgba(255,255,255,0.08)'
const UP = '#F0876A'   // 空き家率の上昇＝貸す側には逆風
const DOWN = '#4CC182'
const JONAN = ['品川区', '目黒区', '大田区', '世田谷区']
const PAST = AKIYA_YEARS.filter(y => y !== 2023)

export default async function AreasPage() {
  let areas: Area[] = []
  if (supabaseConfig()) {
    const { data, error } = await sb<Area[]>('fudosan_area_stats?select=*&order=unit_price_man.desc')
    if (error) console.error('[fudosan/areas]', error)
    areas = data ?? []
  }

  const withTrend = areas.filter(a => a.trend_10y != null)
  const rising = [...withTrend].sort((a, b) => (b.trend_10y ?? 0) - (a.trend_10y ?? 0))

  const unitMed = median(areas.map(a => a.unit_price_man).filter((v): v is number => v != null))
  const bargains = withTrend
    .filter(a => (a.unit_price_man ?? 1e9) <= unitMed && a.trade_count >= 50)
    .sort((a, b) => (b.trend_10y ?? 0) - (a.trend_10y ?? 0))
    .slice(0, 6)

  const totalTrades = areas.reduce((s, a) => s + a.trade_count, 0)

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: '34px 22px 80px' }}>
      <header style={{ marginBottom: 26 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 26, color: INK, margin: 0, letterSpacing: '-0.01em' }}>エリア分析</h1>
          <Link href="/fudosan" style={{ fontSize: 13, color: GOLD, textDecoration: 'none' }}>← 物件一覧</Link>
        </div>
        <div style={{ fontSize: 11.5, color: FAINT, letterSpacing: '0.12em', marginTop: 6 }}>
          JONAN · 20–30㎡ · 2014–2026 · MLIT REAL ESTATE LIBRARY
        </div>
        <p style={{ fontSize: 13.5, color: MUTED, marginTop: 12, lineHeight: 1.8 }}>
          城南4区を駅圏エリアに束ね、区分ワンルーム帯の単価・価格帯・上昇率を12年分の実成約から出しています。<br />
          物件を待つのではなく、<b style={{ color: INK }}>先にエリアを決めて探しにいく</b>ための画面です。
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        <Stat label="対象エリア" value={`${areas.length}`} unit="エリア" />
        <Stat label="成約データ" value={totalTrades.toLocaleString()} unit="件（20–30㎡）" />
        <Stat label="㎡単価 中央値" value={unitMed.toFixed(1)} unit="万円/㎡" />
        <Stat
          label="10年で最も上昇"
          value={rising[0] ? `+${rising[0].trend_10y}%` : '—'}
          unit={rising[0] ? `${rising[0].city}${rising[0].district}` : ''}
          accent
        />
      </div>

      {bargains.length > 0 && (
        <section style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: '18px 20px', marginBottom: 24 }}>
          <div style={{ fontSize: 14, color: INK }}>単価が中央値以下で、10年伸びているエリア</div>
          <div style={{ fontSize: 12, color: MUTED, margin: '4px 0 16px' }}>
            成約50件以上に限定（出口の流動性を確保）。ここを起点に物件を探すのが、いちばん効率のいい入口です。
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            {bargains.map(a => (
              <div key={`${a.city}-${a.district}`} style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: '13px 15px' }}>
                <div style={{ fontSize: 11.5, color: FAINT }}>{a.city}</div>
                <div style={{ fontSize: 16, color: INK, marginTop: 1 }}>{a.district}</div>
                <div style={{ fontSize: 19, color: '#4CC182', fontWeight: 600, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>
                  +{a.trend_10y}%
                  <span style={{ fontSize: 12, color: MUTED, fontWeight: 400, marginLeft: 8 }}>
                    直近3年 {a.trend_3y == null ? '—' : `${a.trend_3y > 0 ? '+' : ''}${a.trend_3y}%`}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                  {a.unit_price_man}万/㎡ · 中央{a.price_med_man?.toLocaleString()}万 · {a.trade_count}件
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <AreaExplorer areas={areas} />

      <WardAkiyaSection />
    </main>
  )
}

function Stat({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: boolean }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 11.5, color: FAINT }}>{label}</div>
      <div style={{ fontSize: 24, color: accent ? '#4CC182' : INK, fontWeight: 600, marginTop: 3, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
        {value}
      </div>
      {unit && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{unit}</div>}
    </div>
  )
}

function sign(n: number) {
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}`
}

function Spark({ w }: { w: WardAkiya }) {
  // 縦軸は23区共通（7〜16%）。2008年の千代田・中央の20%超は上端で頭打ちにする
  const lo = 7, hi = 16, W = 64, H = 20
  const pts = AKIYA_YEARS.map((y, i) => {
    const v = Math.min(hi, Math.max(lo, w.rate[y]))
    return [(i / (AKIYA_YEARS.length - 1)) * W, H - ((v - lo) / (hi - lo)) * H] as const
  })
  const color = w.trend === '上昇' ? UP : w.trend === '低下' ? DOWN : FAINT
  return (
    <svg width={W} height={H} viewBox={`-2 -2 ${W + 4} ${H + 4}`} aria-hidden style={{ display: 'block' }}>
      <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={pts[3][0]} cy={pts[3][1]} r={2.2} fill={color} />
    </svg>
  )
}

function WardAkiyaSection() {
  const rows = [...WARD_AKIYA_LIST].sort((a, b) => b.change5y - a.change5y)
  const count = (t: WardAkiya['trend']) => rows.filter(r => r.trend === t).length
  const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 500, color: FAINT, fontSize: 11.5, whiteSpace: 'nowrap', borderBottom: `1px solid ${LINE}` }
  const td: React.CSSProperties = { padding: '8px 10px', borderBottom: `1px solid ${LINE}`, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
  return (
    <section id="ward-akiya" style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: '18px 20px', marginTop: 24 }}>
      <div style={{ fontSize: 14, color: INK }}>23区の空き家率の推移</div>
      <div style={{ fontSize: 12, color: MUTED, margin: '4px 0 14px', lineHeight: 1.8 }}>
        総務省「住宅・土地統計調査」（5年ごと・2008〜2023年）。直近5年で空き家率が上がった順に並べています。
        23区全体は {TOKUBETSU_KUBU.rate[2018].toFixed(1)}% → {TOKUBETSU_KUBU.rate[2023].toFixed(1)}%（{sign(TOKUBETSU_KUBU.change5y)}pt）。
        上昇 {count('上昇')}区・横ばい {count('横ばい')}区・低下 {count('低下')}区。
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, color: INK }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>区</th>
              <th style={{ ...th, textAlign: 'right' }}>2023</th>
              <th style={{ ...th, textAlign: 'right' }}>5年の変化</th>
              <th style={{ ...th, textAlign: 'left' }}>傾向</th>
              <th style={{ ...th, textAlign: 'left' }}>推移</th>
              {PAST.map(y => <th key={y} style={{ ...th, textAlign: 'right' }}>{y}</th>)}
              <th style={{ ...th, textAlign: 'right' }}>賃貸用の空き家</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const jonan = JONAN.includes(r.ward)
              const c = r.trend === '上昇' ? UP : r.trend === '低下' ? DOWN : MUTED
              return (
                <tr key={r.ward} style={{ background: jonan ? 'rgba(200,169,106,0.07)' : undefined }}>
                  <td style={{ ...td, color: jonan ? GOLD : INK, fontWeight: jonan ? 600 : 400 }}>{r.ward}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{r.rate[2023].toFixed(1)}%</td>
                  <td style={{ ...td, textAlign: 'right', color: c, fontWeight: 600 }}>{sign(r.change5y)}pt</td>
                  <td style={{ ...td, color: c }}>{r.trend}</td>
                  <td style={td}><Spark w={r} /></td>
                  {PAST.map(y => (
                    <td key={y} style={{ ...td, textAlign: 'right', color: MUTED }}>{r.rate[y].toFixed(1)}%</td>
                  ))}
                  <td style={{ ...td, textAlign: 'right', color: MUTED }}>
                    {r.rentRate[2023].toFixed(1)}%<span style={{ marginLeft: 6, fontSize: 11.5 }}>({sign(r.rentChange5y)})</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11.5, color: FAINT, marginTop: 12, lineHeight: 1.8 }}>
        抽出調査のため区単位では誤差があり、5年で±{AKIYA_FLAT_PT.toFixed(1)}pt未満は「横ばい」としています。
        町丁目・駅単位の数字は公表されていません。「賃貸用の空き家」は住宅総数に対する割合です。
        2008年の千代田区・中央区は20%超と突出しており、長期比較は参考程度にご覧ください。
        出典: <a href="https://www.e-stat.go.jp/stat-search/files?toukei=00200522" target="_blank" rel="noreferrer" style={{ color: GOLD }}>e-Stat 住宅・土地統計調査</a>
      </div>
    </section>
  )
}

function median(a: number[]) {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y)
  return s[Math.floor(s.length / 2)]
}
