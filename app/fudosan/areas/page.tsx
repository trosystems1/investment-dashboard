import Link from 'next/link'
import { sb, supabaseConfig } from '@/lib/fudosan/supabase'
import AreaExplorer, { type Area } from '@/components/fudosan/AreaExplorer'

export const revalidate = 60

const GOLD = '#C8A96A'
const INK = '#E8E4D9'
const MUTED = 'rgba(232,228,217,0.55)'
const FAINT = 'rgba(232,228,217,0.32)'
const CARD = 'rgba(255,255,255,0.03)'
const LINE = 'rgba(255,255,255,0.08)'

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

function median(a: number[]) {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y)
  return s[Math.floor(s.length / 2)]
}
