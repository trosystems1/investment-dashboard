'use client'
import { useEffect, useState } from 'react'
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

const RANGES = ['1mo', '3mo', '6mo', '1y'] as const
type Range = typeof RANGES[number]
const RANGE_LABELS: Record<Range, string> = { '1mo': '1M', '3mo': '3M', '6mo': '6M', '1y': '1Y' }

// 利用可能な指数（Lightプランは TOPIX のみ）
const INDICES = [
  { key: 'topix',    label: 'TOPIX',          available: true },
  { key: 'core30',   label: 'Core30',          available: false },
  { key: 'large70',  label: 'Large70',         available: false },
  { key: 'mid400',   label: 'Mid400',          available: false },
  { key: 'small',    label: 'Small',           available: false },
  { key: 'growth250',label: 'グロース250',      available: false },
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const isUp = d.c >= d.o
  return (
    <div style={{ background: 'rgba(13,15,20,0.97)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: '#6B7280', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 20px' }}>
        <span style={{ color: '#6B7280' }}>始値</span><span style={{ color: '#E8E4D9' }}>{d.o?.toFixed(2)}</span>
        <span style={{ color: '#6B7280' }}>高値</span><span style={{ color: '#4ADE80' }}>{d.h?.toFixed(2)}</span>
        <span style={{ color: '#6B7280' }}>安値</span><span style={{ color: '#F87171' }}>{d.l?.toFixed(2)}</span>
        <span style={{ color: '#6B7280' }}>終値</span>
        <span style={{ color: isUp ? '#4ADE80' : '#F87171', fontWeight: 600 }}>{d.c?.toFixed(2)}</span>
      </div>
    </div>
  )
}

// background.y/height + domain から pixel 座標を計算するキャンドル形状
function makeCandleShape(domainMin: number, domainMax: number) {
  return function CandleShape(props: any) {
    const d = props.payload
    if (!d || !props.background) return <g />

    const { x, width } = props
    const bg = props.background
    const range = domainMax - domainMin

    const px = (val: number) => bg.y + bg.height * (1 - (val - domainMin) / range)

    const yO = px(d.o), yC = px(d.c)
    const yH = px(d.h), yL = px(d.l)
    const isUp = d.c >= d.o
    const color = isUp ? '#4ADE80' : '#F87171'
    const bodyTop = Math.min(yO, yC)
    const bodyBot = Math.max(yO, yC)
    const cx = x + width / 2
    const bw = Math.max(width - 2, 2)

    return (
      <g>
        {/* 上ひげ */}
        <line x1={cx} y1={yH} x2={cx} y2={bodyTop} stroke={color} strokeWidth={1.5} />
        {/* ロウソク胴体 */}
        <rect x={x + 1} y={bodyTop} width={bw} height={Math.max(bodyBot - bodyTop, 1)} fill={color} opacity={0.85} rx={1} />
        {/* 下ひげ */}
        <line x1={cx} y1={bodyBot} x2={cx} y2={yL} stroke={color} strokeWidth={1.5} />
      </g>
    )
  }
}

export default function TopixChart() {
  const [range, setRange] = useState<Range>('3mo')
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/topix?range=${range}`)
      .then(r => r.json())
      .then(json => { setData(json.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [range])

  const yMax = data.length ? Math.max(...data.map(d => d.h)) : 0
  const yMin = data.length ? Math.min(...data.map(d => d.l)) : 0
  const yPad = (yMax - yMin) * 0.06
  const domainMin = yMin - yPad
  const domainMax = yMax + yPad

  const latest = data[data.length - 1]
  const prev   = data[data.length - 2]
  const change    = latest && prev ? (latest.c - prev.c).toFixed(2) : null
  const changePct = latest && prev ? ((latest.c - prev.c) / prev.c * 100).toFixed(2) : null
  const isUp = change ? parseFloat(change) >= 0 : true

  const CandleShape = makeCandleShape(domainMin, domainMax)

  return (
    <div>
      {/* ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {/* 指数タブ */}
          <div style={{ display: 'flex', gap: 2 }}>
            {INDICES.map(idx => (
              <button key={idx.key} disabled={!idx.available} style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: idx.available ? 'pointer' : 'default',
                background: idx.available && idx.key === 'topix' ? 'rgba(196,156,72,0.15)' : 'transparent',
                color: idx.available ? '#C49C48' : '#374151',
                opacity: idx.available ? 1 : 0.4,
              }}>
                {idx.label}
                {!idx.available && <span style={{ fontSize: 9, marginLeft: 3 }}>🔒</span>}
              </button>
            ))}
          </div>
          {/* 現在値 */}
          {latest && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 20, fontFamily: 'Georgia, serif', color: '#E8E4D9' }}>{latest.c.toFixed(2)}</span>
              {change && (
                <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 8,
                  background: isUp ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                  color: isUp ? '#4ADE80' : '#F87171' }}>
                  {isUp ? '+' : ''}{change} ({isUp ? '+' : ''}{changePct}%)
                </span>
              )}
            </div>
          )}
        </div>
        {/* 期間タブ */}
        <div style={{ display: 'flex', gap: 4 }}>
          {RANGES.map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: 'none',
              background: range === r ? 'rgba(196,156,72,0.15)' : 'transparent',
              color: range === r ? '#C49C48' : '#6B7280',
            }}>{RANGE_LABELS[r]}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4B5563', fontSize: 13 }}>Loading...</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#4B5563', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis domain={[domainMin, domainMax]} tick={{ fill: '#4B5563', fontSize: 10 }} tickLine={false} axisLine={false} width={60} tickFormatter={v => v.toFixed(0)} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />
            <Bar dataKey="c" shape={<CandleShape />} isAnimationActive={false}>
              {data.map((d, i) => <Cell key={i} fill={d.c >= d.o ? '#4ADE80' : '#F87171'} />)}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
