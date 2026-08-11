'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'

type USQuote = {
  ticker: string
  companyName: string
  sector: string
  price: number | null
  changePct: number | null
  volume: number | null
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
  dayHigh: number | null
  dayLow: number | null
  sparkline: number[]
}

type ChartPoint = { time: number; close: number }
type RangePreset = 'day' | 'month' | 'year'

const RANGE_LABELS: { key: RangePreset; label: string }[] = [
  { key: 'day', label: '日' },
  { key: 'month', label: '月' },
  { key: 'year', label: '年' },
]

function formatVolume(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return `${v}`
}

function RangeBar({ price, high, low, label }: { price: number | null; high: number | null; low: number | null; label: string }) {
  if (price == null || high == null || low == null || high <= low) return null
  const pct = Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100))
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: '#9CA3AF', minWidth: 50 }}>${low.toFixed(2)}</span>
        <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, position: 'relative' }}>
          <div style={{ position: 'absolute', left: `${pct}%`, top: -2, width: 8, height: 8, borderRadius: 4, background: '#C49C48', transform: 'translateX(-50%)' }} />
        </div>
        <span style={{ fontSize: 11, color: '#9CA3AF', minWidth: 50, textAlign: 'right' }}>${high.toFixed(2)}</span>
      </div>
    </div>
  )
}

function BigChart({ points, up, preset }: { points: ChartPoint[]; up: boolean; preset: RangePreset }) {
  if (!points || points.length < 2) {
    return <div style={{ fontSize: 12, color: '#4B5563', padding: '60px 0', textAlign: 'center' }}>チャートデータがありません</div>
  }
  const closes = points.map(p => p.close)
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const range = max - min || 1
  const W = 700
  const H = 220
  const pathPoints = points
    .map((p, i) => `${(i / (points.length - 1)) * W},${H - ((p.close - min) / range) * H}`)
    .join(' ')

  const dateFmt = (t: number) => {
    const d = new Date(t * 1000)
    if (preset === 'day') return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
    if (preset === 'month') return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
    return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric' })
  }

  return (
    <div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <polyline points={pathPoints} fill="none" stroke={up ? '#4ade80' : '#f87171'} strokeWidth="2" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: '#4B5563' }}>
        <span>{dateFmt(points[0].time)}</span>
        <span>{dateFmt(points[points.length - 1].time)}</span>
      </div>
    </div>
  )
}

export default function USTickerDetailPage() {
  const params = useParams()
  const ticker = String(params.ticker ?? '').toUpperCase()
  const [quote, setQuote] = useState<USQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [preset, setPreset] = useState<RangePreset>('month')
  const [chartPoints, setChartPoints] = useState<ChartPoint[]>([])
  const [chartLoading, setChartLoading] = useState(true)

  useEffect(() => {
    if (!ticker) return
    fetch(`/api/us-watchlist/${ticker}`)
      .then(async r => {
        if (r.status === 404) {
          setNotFound(true)
          setLoading(false)
          return
        }
        const d = await r.json()
        setQuote(d.quote ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [ticker])

  const loadChart = useCallback((p: RangePreset) => {
    if (!ticker) return
    setChartLoading(true)
    fetch(`/api/us-watchlist/${ticker}/chart?range=${p}`)
      .then(r => r.json())
      .then(d => {
        setChartPoints(d.points ?? [])
        setChartLoading(false)
      })
      .catch(() => setChartLoading(false))
  }, [ticker])

  useEffect(() => {
    loadChart(preset)
  }, [preset, loadChart])

  const up = quote && (quote.changePct ?? 0) >= 0

  return (
    <div className="p-4 md:p-6" style={{ minHeight: '100vh', background: '#0D0F14', color: '#E8E4D9' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <a href="/watchlist/us" style={{ fontSize: 12, color: '#818CF8', textDecoration: 'none' }}>
          ← US Watchlist に戻る
        </a>

        {loading ? (
          <div style={{ color: '#6B7280', fontSize: 13, textAlign: 'center', paddingTop: 60 }}>読み込み中...</div>
        ) : notFound || !quote ? (
          <div style={{ color: '#6B7280', fontSize: 13, textAlign: 'center', paddingTop: 60 }}>
            銘柄「{ticker}」が見つかりませんでした。
          </div>
        ) : (
          <>
            <div style={{ marginTop: 20, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <h2 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{quote.ticker}</h2>
                <span style={{ fontSize: 14, color: '#6B7280' }}>{quote.companyName}</span>
              </div>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, color: '#C49C48', background: 'rgba(196,156,72,0.1)', border: '0.5px solid rgba(196,156,72,0.3)', display: 'inline-block', marginTop: 8 }}>
                {quote.sector}
              </span>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 16 }}>
                <span style={{ fontSize: 36, fontWeight: 700 }}>
                  {quote.price != null ? `$${quote.price.toFixed(2)}` : '—'}
                </span>
                {quote.changePct != null && (
                  <span
                    style={{
                      fontSize: 16, fontWeight: 700, padding: '3px 12px', borderRadius: 8,
                      background: up ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
                      color: up ? '#4ade80' : '#f87171',
                    }}
                  >
                    {up ? '+' : ''}{quote.changePct}%
                  </span>
                )}
              </div>

              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>出来高: {formatVolume(quote.volume)}</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16, maxWidth: 360 }}>
                <RangeBar price={quote.price} high={quote.dayHigh} low={quote.dayLow} label="本日のレンジ" />
                <RangeBar price={quote.price} high={quote.fiftyTwoWeekHigh} low={quote.fiftyTwoWeekLow} label="52週レンジ" />
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '20px 16px', marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#6B7280', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  値動き
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {RANGE_LABELS.map(r => (
                    <button
                      key={r.key}
                      onClick={() => setPreset(r.key)}
                      style={{
                        fontSize: 11, padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
                        border: 'none',
                        background: preset === r.key ? 'rgba(196,156,72,0.15)' : 'transparent',
                        color: preset === r.key ? '#C49C48' : '#6B7280',
                      }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              {chartLoading ? (
                <div style={{ fontSize: 12, color: '#4B5563', padding: '60px 0', textAlign: 'center' }}>読み込み中...</div>
              ) : (
                <BigChart points={chartPoints} up={!!up} preset={preset} />
              )}
            </div>

            <div style={{ fontSize: 12, color: '#4B5563', textAlign: 'center', marginTop: 32 }}>
              決算反応パターンなどの詳細分析は今後追加予定です
            </div>
          </>
        )}
      </div>
    </div>
  )
}
