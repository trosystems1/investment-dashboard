'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts'

const RANGES = ['1mo', '3mo', '6mo', '1y'] as const
type Range = typeof RANGES[number]
const RANGE_LABELS: Record<Range, string> = { '1mo': '1M', '3mo': '3M', '6mo': '6M', '1y': '1Y' }

interface StockDetail {
  symbol: string; name: string; sector: string; description: string
  price: number; prevClose: number; open: number; dayHigh: number; dayLow: number
  week52High: number; week52Low: number; marketCap: number
  per: number; forwardPer: number; pbr: number
  dividendAmount: number; dividendYield: number
  eps: number; volume: number; currency: string; source?: string
}

function fmt(v: number, currency: string) {
  if (currency === 'JPY') return `¥${v.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}`
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtCap(v: number, currency: string) {
  const sym = currency === 'JPY' ? '¥' : '$'
  if (currency === 'JPY') {
    if (v >= 1e12) return `${sym}${(v / 1e12).toFixed(1)}兆`
    return `${sym}${(v / 1e8).toFixed(0)}億`
  }
  if (v >= 1e12) return `${sym}${(v / 1e12).toFixed(2)}T`
  return `${sym}${(v / 1e9).toFixed(1)}B`
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'rgba(13,15,20,0.97)', border: '0.5px solid rgba(196,156,72,0.3)', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
      <div style={{ color: '#6B7280', marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#C49C48', fontWeight: 500 }}>{payload[0].value?.toLocaleString()}</div>
    </div>
  )
}

function StatCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? 'rgba(196,156,72,0.06)' : 'rgba(255,255,255,0.03)',
      border: `0.5px solid ${highlight ? 'rgba(196,156,72,0.25)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: 10, padding: '14px 16px',
    }}>
      <div style={{ fontSize: 11, color: '#6B7280', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontFamily: 'DM Serif Display, serif', color: highlight ? '#C49C48' : '#E8E4D9', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#4B5563', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function StockDetailPage() {
  const params = useParams()
  const router = useRouter()
  const symbol = decodeURIComponent(params.symbol as string)

  const [detail, setDetail] = useState<StockDetail | null>(null)
  const [chartData, setChartData] = useState<{ date: string; value: number }[]>([])
  const [range, setRange] = useState<Range>('3mo')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/stock-detail?symbol=${symbol}`)
      .then(r => r.json())
      .then(d => setDetail(d))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [symbol])

  useEffect(() => {
    fetch(`/api/chart?symbol=${symbol}&range=${range}`)
      .then(r => r.json())
      .then(d => setChartData(d.data || []))
      .catch(console.error)
  }, [symbol, range])

  const changePct = detail ? ((detail.price - detail.prevClose) / detail.prevClose * 100) : 0
  const isUp = changePct >= 0

  // 52週水位 (0〜100%)
  const waterLevel = detail
    ? Math.round((detail.price - detail.week52Low) / (detail.week52High - detail.week52Low) * 100)
    : 0

  // チャート用 平均ライン
  const avgPrice = chartData.length ? chartData.reduce((s, d) => s + d.value, 0) / chartData.length : 0

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0D0F14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#C49C48', fontSize: 14 }}>Loading...</div>
      </div>
    )
  }

  if (!detail || (detail as any).error) {
    return (
      <div style={{ minHeight: '100vh', background: '#0D0F14', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ color: '#F87171', fontSize: 14 }}>銘柄が見つかりません: {symbol}</div>
        <button onClick={() => router.push('/')} style={{ color: '#C49C48', background: 'transparent', border: '0.5px solid rgba(196,156,72,0.3)', padding: '8px 20px', borderRadius: 20, cursor: 'pointer', fontSize: 13 }}>← 戻る</button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0D0F14', padding: '24px', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#E8E4D9' }}>
      {/* Ambient */}
      <div style={{ position: 'fixed', top: -200, right: -200, width: 500, height: 500, background: 'radial-gradient(circle, rgba(196,156,72,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative' }}>
        {/* Back */}
        <button onClick={() => router.push('/')} style={{
          display: 'flex', alignItems: 'center', gap: 6, color: '#6B7280', background: 'transparent',
          border: 'none', cursor: 'pointer', fontSize: 13, marginBottom: 24, padding: 0,
        }}>
          ← ダッシュボードに戻る
        </button>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 30, margin: 0, color: '#E8E4D9' }}>{detail.name}</h1>
              {detail.source === 'mock' && (
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: 'rgba(255,165,0,0.12)', color: '#FFA500' }}>DEMO</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>
              {symbol.replace('.T', '')} · {detail.sector}
            </div>
            <div style={{ width: 40, height: 2, background: 'linear-gradient(to right, #C49C48, transparent)', borderRadius: 1, marginTop: 8 }} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: 36, color: '#E8E4D9', lineHeight: 1 }}>
              {fmt(detail.price, detail.currency || 'JPY')}
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6,
              fontSize: 14, padding: '3px 10px', borderRadius: 12,
              background: isUp ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              color: isUp ? '#4ADE80' : '#F87171',
            }}>
              {isUp ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}% 前日比
            </div>
          </div>
        </div>

        {/* Main grid: chart + water level */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, marginBottom: 16 }}>

          {/* Chart */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 14, color: '#B8B4A8', fontWeight: 500 }}>株価チャート</span>
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
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C49C48" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#C49C48" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#4B5563', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#4B5563', fontSize: 10 }} tickLine={false} axisLine={false} width={65} tickFormatter={v => v.toLocaleString()} domain={['auto', 'auto']} />
                <Tooltip content={<CustomTooltip />} />
                {avgPrice > 0 && (
                  <ReferenceLine y={avgPrice} stroke="rgba(196,156,72,0.4)" strokeDasharray="4 3"
                    label={{ value: '平均', fill: '#C49C48', fontSize: 10, position: 'insideTopRight' }} />
                )}
                <Area type="monotone" dataKey="value" stroke="#C49C48" strokeWidth={2} fill="url(#dg)" dot={false} activeDot={{ r: 4, fill: '#C49C48', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
            {/* Day range bar */}
            <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6B7280', marginBottom: 6 }}>
                <span>本日安値 {fmt(detail.dayLow, detail.currency || 'JPY')}</span>
                <span>本日高値 {fmt(detail.dayHigh, detail.currency || 'JPY')}</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, position: 'relative' }}>
                <div style={{
                  position: 'absolute', height: '100%', borderRadius: 2,
                  background: 'linear-gradient(to right, #3B82F6, #C49C48)',
                  width: `${((detail.price - detail.dayLow) / (detail.dayHigh - detail.dayLow) * 100).toFixed(0)}%`,
                }} />
              </div>
            </div>
          </div>

          {/* Water Level */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 14, color: '#B8B4A8', fontWeight: 500, marginBottom: 20 }}>52週水位</div>

            {/* Vertical water gauge */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ fontSize: 11, color: '#6B7280' }}>{fmt(detail.week52High, detail.currency || 'JPY')} (高値)</div>
              <div style={{ position: 'relative', width: 80, height: 160, background: 'rgba(255,255,255,0.05)', borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                {/* Water fill */}
                <div style={{
                  position: 'absolute', bottom: 0, width: '100%',
                  height: `${waterLevel}%`,
                  background: waterLevel > 70
                    ? 'linear-gradient(to top, rgba(196,156,72,0.8), rgba(196,156,72,0.4))'
                    : waterLevel > 40
                    ? 'linear-gradient(to top, rgba(59,130,246,0.7), rgba(59,130,246,0.3))'
                    : 'linear-gradient(to top, rgba(248,113,113,0.7), rgba(248,113,113,0.3))',
                  transition: 'height 1s ease',
                }} />
                {/* Current price line */}
                <div style={{
                  position: 'absolute', bottom: `${waterLevel}%`, width: '100%',
                  height: 2, background: '#C49C48',
                }} />
                {/* Percentage label */}
                <div style={{
                  position: 'absolute', width: '100%', textAlign: 'center',
                  bottom: `${Math.min(waterLevel + 5, 88)}%`,
                  fontSize: 14, fontWeight: 700, color: '#fff',
                  textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                }}>
                  {waterLevel}%
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>{fmt(detail.week52Low, detail.currency || 'JPY')} (安値)</div>
            </div>

            <div style={{ marginTop: 16, padding: '10px 12px', background: 'rgba(196,156,72,0.05)', borderRadius: 8, border: '0.5px solid rgba(196,156,72,0.15)', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>52週レンジ内の現在位置</div>
              <div style={{ fontSize: 13, color: '#C49C48' }}>
                {waterLevel >= 80 ? '高値圏' : waterLevel >= 50 ? '中値圏' : waterLevel >= 20 ? '安値圏' : '底値圏'}
              </div>
            </div>
          </div>
        </div>

        {/* Metrics grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          <StatCard label="予想PER" value={`${detail.forwardPer?.toFixed(1)}x`} sub={`実績PER ${detail.per?.toFixed(1)}x`} highlight />
          <StatCard label="PBR" value={`${detail.pbr?.toFixed(2)}x`} sub="株価純資産倍率" />
          <StatCard label="配当利回り" value={`${detail.dividendYield?.toFixed(2)}%`} sub={`${detail.currency === 'JPY' ? '¥' : '$'}${detail.dividendAmount} / 年`} highlight />
          <StatCard label="時価総額" value={fmtCap(detail.marketCap, detail.currency || 'JPY')} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          <StatCard label="EPS（1株益）" value={`${detail.currency === 'JPY' ? '¥' : '$'}${detail.eps?.toLocaleString()}`} />
          <StatCard label="始値" value={fmt(detail.open, detail.currency || 'JPY')} />
          <StatCard label="出来高" value={detail.volume?.toLocaleString()} sub="株" />
          <StatCard label="前日終値" value={fmt(detail.prevClose, detail.currency || 'JPY')} />
        </div>

        {/* Description */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 13, color: '#B8B4A8', fontWeight: 500, marginBottom: 8 }}>企業概要</div>
          <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.7 }}>{detail.description}</div>
        </div>
      </div>
    </div>
  )
}
