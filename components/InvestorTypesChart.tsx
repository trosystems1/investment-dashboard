'use client'
import { useEffect, useState } from 'react'
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Legend, ResponsiveContainer,
} from 'recharts'

const SECTIONS = ['TokyoNagoya', 'TSEPrime', 'TSEStandard', 'TSEGrowth'] as const
type Section = typeof SECTIONS[number]

const SECTION_LABELS: Record<Section, string> = {
  TokyoNagoya: '全体',
  TSEPrime:    'プライム',
  TSEStandard: 'スタンダード',
  TSEGrowth:   'グロース',
}

const INVESTORS = [
  { key: 'frgn',    label: '海外',    color: '#C49C48' },
  { key: 'ind',     label: '個人',    color: '#60A5FA' },
  { key: 'invTr',   label: '投信',    color: '#A78BFA' },
  { key: 'trstBnk', label: '信託銀行', color: '#34D399' },
  { key: 'busCo',   label: '事業法人', color: '#FB923C' },
  { key: 'insCo',   label: '生保損保', color: '#F472B6' },
] as const

type InvestorKey = typeof INVESTORS[number]['key']
type DisplayMode = 'Bal' | 'Buy' | 'Sell'

const MODE_LABELS: Record<DisplayMode, string> = {
  Bal:  '差引',
  Buy:  '買い',
  Sell: '売り',
}

const fmtY = (v: number) => {
  const abs = Math.abs(v)
  if (abs >= 1e12) return (v / 1e12).toFixed(1) + '兆'
  if (abs >= 1e8)  return (v / 1e8).toFixed(0) + '億'
  if (abs >= 1e6)  return (v / 1e6).toFixed(0) + '百万'
  return (v / 1e3).toFixed(0) + '千'
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'rgba(13,15,20,0.97)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 12, minWidth: 160 }}>
      <div style={{ color: '#6B7280', marginBottom: 8 }}>{label}</div>
      {payload
        .filter((p: any) => p.value !== 0 && p.value != null)
        .sort((a: any, b: any) => Math.abs(b.value) - Math.abs(a.value))
        .map((p: any) => (
          <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
            <span style={{ color: p.fill }}>{p.name}</span>
            <span style={{ color: p.value > 0 ? '#4ADE80' : '#F87171', fontWeight: 500 }}>
              {p.value > 0 ? '+' : ''}{fmtY(p.value)}
            </span>
          </div>
        ))}
    </div>
  )
}

const btn = (active: boolean, color?: string) => ({
  fontSize: 11,
  padding: '4px 10px',
  borderRadius: 6,
  cursor: 'pointer' as const,
  border: 'none',
  borderBottom: color ? `2px solid ${active ? color : 'transparent'}` : undefined,
  background: active ? 'rgba(196,156,72,0.15)' : 'transparent',
  color: active ? (color ?? '#C49C48') : '#6B7280',
})

export default function InvestorTypesChart() {
  const [section,  setSection]  = useState<Section>('TokyoNagoya')
  const [investor, setInvestor] = useState<InvestorKey | 'all'>('all')
  const [mode,     setMode]     = useState<DisplayMode>('Bal')
  const [data,     setData]     = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/market-sentiment?section=${section}`)
      .then(r => r.json())
      .then(json => {
        const rows = (json.data || []).map((r: any) => ({
          ...r,
          label: r.stDate?.slice(5) + '〜' + r.enDate?.slice(5),
        }))
        setData(rows)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [section])

  const visibleInvestors = investor === 'all'
    ? INVESTORS
    : INVESTORS.filter(i => i.key === investor)

  // 差引モードのみ積み上げ
  const stackId = mode === 'Bal' ? 'a' : undefined

  const subtitle = mode === 'Bal'
    ? '週次集計・買い越し↑ / 売り越し↓'
    : mode === 'Buy' ? '週次買い金額'
    : '週次売り金額'

  return (
    <div>
      {/* 1行目：タイトル + 市場フィルタ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 14, color: '#B8B4A8', fontWeight: 500 }}>投資部門別売買動向</div>
          <div style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>{subtitle}</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {SECTIONS.map(s => (
            <button key={s} onClick={() => setSection(s)} style={btn(section === s)}>
              {SECTION_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* 2行目：投資家フィルタ + 表示モード */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button onClick={() => setInvestor('all')} style={btn(investor === 'all')}>
            全投資家
          </button>
          {INVESTORS.map(inv => (
            <button key={inv.key} onClick={() => setInvestor(inv.key)}
              style={btn(investor === inv.key, inv.color)}>
              {inv.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(Object.keys(MODE_LABELS) as DisplayMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} style={btn(mode === m)}>
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4B5563', fontSize: 13 }}>Loading...</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }} stackOffset="sign">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#4B5563', fontSize: 9 }}
              tickLine={false} axisLine={false}
              interval={3}
            />
            <YAxis
              tick={{ fill: '#4B5563', fontSize: 10 }}
              tickLine={false} axisLine={false}
              width={55}
              tickFormatter={fmtY}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
            <Legend
              iconType="square"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, color: '#6B7280', paddingTop: 8 }}
            />
            {visibleInvestors.map(({ key, label, color }) => (
              <Bar
                key={`${key}${mode}`}
                dataKey={`${key}${mode}`}
                name={label}
                stackId={stackId}
                fill={color}
                opacity={0.85}
                radius={0}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}