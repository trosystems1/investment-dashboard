'use client'

import { useState, useEffect } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const RANGES = ['1mo', '3mo', '6mo', '1y'] as const
type Range = typeof RANGES[number]
const RANGE_LABELS: Record<Range, string> = { '1mo': '1M', '3mo': '3M', '6mo': '6M', '1y': '1Y' }

const SYMBOLS = [
  { key: '^N225', label: 'N225' },
  { key: '^GSPC', label: 'S&P' },
  { key: 'JPY=X', label: 'JPY' },
  { key: 'GC=F',  label: 'Gold' },
  { key: 'BTC-USD', label: 'BTC' },
]

interface ChartPoint { date: string; value: number }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(13,15,20,0.95)', border: '0.5px solid rgba(196,156,72,0.3)',
      padding: '8px 12px', borderRadius: 8, fontSize: 12,
    }}>
      <div style={{ color: '#6B7280', marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#C49C48', fontWeight: 500 }}>{payload[0].value?.toLocaleString()}</div>
    </div>
  )
}

export default function PerformanceChart({ symbol: initialSymbol = '^N225', onSymbolChange }: { symbol?: string; onSymbolChange?: (s: string) => void }) {
  const [symbol, setSymbol] = useState(initialSymbol)
  const [range, setRange] = useState<Range>('3mo')
  const [data, setData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [isMock, setIsMock] = useState(false)

  useEffect(() => { setSymbol(initialSymbol) }, [initialSymbol])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/chart?symbol=${symbol}&range=${range}`)
      .then(r => r.json())
      .then(json => {
        setData(json.data || [])
        setIsMock(json.source === 'mock')
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [range, symbol])

  const handleSymbolChange = (s: string) => {
    setSymbol(s)
    onSymbolChange?.(s)
  }

  const first = data[0]?.value
  const last = data[data.length - 1]?.value
  const pctChange = first && last ? ((last - first) / first * 100).toFixed(2) : null
  const isUp = pctChange ? parseFloat(pctChange) >= 0 : true

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, color: '#B8B4A8', fontWeight: 500 }}>Market Chart</span>
          {pctChange && (
            <span style={{
              fontSize: 12, padding: '2px 8px', borderRadius: 10,
              background: isUp ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              color: isUp ? '#4ADE80' : '#F87171',
            }}>
              {isUp ? '+' : ''}{pctChange}%
            </span>
          )}
          {isMock && (
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: 'rgba(255,165,0,0.12)', color: '#FFA500' }}>
              DEMO
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {RANGES.map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
              border: 'none', letterSpacing: '0.5px',
              background: range === r ? 'rgba(196,156,72,0.15)' : 'transparent',
              color: range === r ? '#C49C48' : '#6B7280',
            }}>
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 13 }}>
          <span style={{ animation: 'pulse 1.5s infinite' }}>Loading...</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#C49C48" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#C49C48" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#4B5563', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#4B5563', fontSize: 11 }} tickLine={false} axisLine={false} width={65} tickFormatter={v => v.toLocaleString()} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="value" stroke="#C49C48" strokeWidth={2} fill="url(#goldGrad)" dot={false} activeDot={{ r: 4, fill: '#C49C48', strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        {SYMBOLS.map(s => (
          <button key={s.key} onClick={() => handleSymbolChange(s.key)} style={{
            fontSize: 10, padding: '3px 8px', borderRadius: 5, cursor: 'pointer',
            border: `0.5px solid ${symbol === s.key ? 'rgba(196,156,72,0.4)' : 'rgba(255,255,255,0.08)'}`,
            background: symbol === s.key ? 'rgba(196,156,72,0.08)' : 'transparent',
            color: symbol === s.key ? '#C49C48' : '#6B7280',
          }}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
