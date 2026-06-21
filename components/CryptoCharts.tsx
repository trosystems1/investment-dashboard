'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type ChartCandle = {
  time: number
  label: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  rsi: number | null
  volSpike: boolean
}

function formatChartLabel(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatPrice(productCode: string, price: number): string {
  if (productCode.endsWith('_JPY')) return `¥${Math.round(price).toLocaleString('ja-JP')}`
  return price.toLocaleString('ja-JP', { maximumFractionDigits: 8 })
}

const PriceTooltip = ({ active, payload, productCode }: { active?: boolean; payload?: { payload: ChartCandle }[]; productCode: string }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: 'rgba(13,15,20,0.97)', border: '0.5px solid rgba(129,140,248,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: '#6B7280', marginBottom: 6 }}>{d.label}</div>
      <div style={{ color: '#818CF8', fontWeight: 600, marginBottom: 4 }}>{formatPrice(productCode, d.close)}</div>
      <div style={{ color: '#9CA3AF' }}>出来高 {d.volume.toFixed(4)}</div>
    </div>
  )
}

const RsiTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: ChartCandle }[] }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: 'rgba(13,15,20,0.97)', border: '0.5px solid rgba(129,140,248,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: '#6B7280', marginBottom: 4 }}>{d.label}</div>
      <div style={{ color: '#818CF8', fontWeight: 600 }}>RSI {d.rsi ?? '—'}</div>
    </div>
  )
}

export default function CryptoCharts({ productCode }: { productCode: string }) {
  const [data, setData] = useState<ChartCandle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/crypto/chart?product_code=${encodeURIComponent(productCode)}&limit=100`)
      .then(async (r) => {
        const json = await r.json()
        if (!r.ok) {
          setError(json.error ?? `HTTP ${r.status}`)
          setData([])
          return
        }
        const raw = (json.candles ?? []) as Array<Omit<ChartCandle, 'label' | 'volSpike'>>
        if (raw.length === 0) {
          setError(null)
          setData([])
          return
        }
        const avgVol = raw.reduce((s, c) => s + c.volume, 0) / raw.length
        setData(
          raw.map((c) => ({
            ...c,
            label: formatChartLabel(c.time),
            volSpike: avgVol > 0 && c.volume >= avgVol * 3,
          })),
        )
      })
      .catch(() => {
        setError('チャートデータの取得に失敗しました')
        setData([])
      })
      .finally(() => setLoading(false))
  }, [productCode])

  const rsiData = useMemo(() => data.filter((d) => d.rsi != null), [data])

  if (loading) {
    return (
      <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 13 }}>
        チャート読み込み中...
      </div>
    )
  }

  if (error || data.length === 0) {
    return (
      <p style={{ fontSize: 12, color: '#4B5563', margin: '0 0 16px' }}>
        {error ?? '5分足データがまだありません。Cron実行後に表示されます。'}
      </p>
    )
  }

  return (
    <div style={{ marginBottom: 20, width: '100%', minWidth: 0 }}>
      <p style={{ fontSize: 11, color: '#6B7280', letterSpacing: '0.08em', margin: '0 0 8px', textTransform: 'uppercase' }}>
        価格・出来高（5分足 {data.length}本）
      </p>
      <div style={{ width: '100%', height: 200, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`cryptoPrice-${productCode}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#818CF8" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#818CF8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#4B5563', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis
            yAxisId="price"
            tick={{ fill: '#4B5563', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={72}
            tickFormatter={(v) => (productCode.endsWith('_JPY') ? `${(v / 1e6).toFixed(1)}M` : String(v))}
            domain={['auto', 'auto']}
          />
          <YAxis yAxisId="volume" orientation="right" hide domain={[0, 'auto']} />
          <Tooltip content={<PriceTooltip productCode={productCode} />} />
          <Area
            yAxisId="price"
            type="monotone"
            dataKey="close"
            stroke="#818CF8"
            strokeWidth={2}
            fill={`url(#cryptoPrice-${productCode})`}
            dot={false}
          />
          <Bar yAxisId="volume" dataKey="volume" barSize={4} radius={[1, 1, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.volSpike ? 'rgba(251,146,60,0.85)' : 'rgba(129,140,248,0.35)'} />
            ))}
          </Bar>
        </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p style={{ fontSize: 11, color: '#6B7280', letterSpacing: '0.08em', margin: '16px 0 8px', textTransform: 'uppercase' }}>
        RSI(14)
      </p>
      {rsiData.length === 0 ? (
        <p style={{ fontSize: 12, color: '#4B5563', margin: 0 }}>RSI計算に必要な足数が不足しています。</p>
      ) : (
        <div style={{ width: '100%', height: 140, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rsiData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#4B5563', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis domain={[0, 100]} tick={{ fill: '#4B5563', fontSize: 10 }} tickLine={false} axisLine={false} width={32} />
            <ReferenceArea y1={0} y2={30} fill="rgba(251,146,60,0.08)" />
            <ReferenceLine y={30} stroke="rgba(251,146,60,0.5)" strokeDasharray="4 4" />
            <ReferenceLine y={70} stroke="rgba(248,113,113,0.4)" strokeDasharray="4 4" />
            <Tooltip content={<RsiTooltip />} />
            <Line type="monotone" dataKey="rsi" stroke="#818CF8" strokeWidth={2} dot={false} connectNulls />
          </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
