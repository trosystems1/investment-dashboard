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
  TSEPrime: 'プライム',
  TSEStandard: 'スタンダード',
  TSEGrowth: 'グロース',
}

const CATEGORIES = [
  { key: 'frgn',    label: '海外',   color: '#C49C48' },
  { key: 'ind',     label: '個人',   color: '#60A5FA' },
  { key: 'invTr',   label: '投信',   color: '#A78BFA' },
  { key: 'trstBnk', label: '信託銀行', color: '#34D399' },
  { key: 'busCo',   label: '事業法人', color: '#FB923C' },
  { key: 'insCo',   label: '生保損保', color: '#F472B6' },
] as const

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
        .filter((p: any) => p.value !== 0)
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

export default function InvestorTypesChart() {
  const [section, setSection] = useState<Section>('TokyoNagoya')
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, color: '#B8B4A8', fontWeight: 500 }}>投資部門別売買動向</div>
          <div style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>週次集計・買い越し↑ / 売り越し↓</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {SECTIONS.map(s => (
            <button key={s} onClick={() => setSection(s)} style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: 'none',
              background: section === s ? 'rgba(196,156,72,0.15)' : 'transparent',
              color: section === s ? '#C49C48' : '#6B7280',
            }}>
              {SECTION_LABELS[s]}
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
            {CATEGORIES.map(({ key, label, color }) => (
              <Bar key={key} dataKey={key} name={label} stackId="a" fill={color} opacity={0.85} radius={0} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
