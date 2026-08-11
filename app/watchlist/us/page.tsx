'use client'

import { useEffect, useState, type CSSProperties } from 'react'

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

function formatVolume(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return `${v}`
}

function Range52w({ price, high, low }: { price: number | null; high: number | null; low: number | null }) {
  if (price == null || high == null || low == null || high <= low) return <span style={{ color: '#6B7280' }}>—</span>
  const pct = Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100))
  return (
    <div style={{ width: 70 }}>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, position: 'relative' }}>
        <div style={{ position: 'absolute', left: `${pct}%`, top: -2, width: 8, height: 8, borderRadius: 4, background: '#C49C48', transform: 'translateX(-50%)' }} />
      </div>
      <div style={{ fontSize: 9, color: '#6B7280', marginTop: 3 }}>{pct.toFixed(0)}%</div>
    </div>
  )
}

function SparklineWithChange({ data, changePct }: { data: number[]; changePct: number | null }) {
  const up = (changePct ?? 0) >= 0
  const color = changePct == null ? '#6B7280' : up ? '#4ade80' : '#f87171'
  let points = ''
  if (data && data.length >= 2) {
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    points = data.map((v, i) => `${(i / (data.length - 1)) * 50},${22 - ((v - min) / range) * 22}`).join(' ')
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
      <svg width="50" height="22" style={{ display: 'block', flexShrink: 0 }}>
        {points && <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />}
      </svg>
      <span
        style={{
          fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6, minWidth: 56, textAlign: 'center',
          background: changePct == null ? 'transparent' : up ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
          color,
        }}
      >
        {changePct != null ? `${up ? '+' : ''}${changePct}%` : '—'}
      </span>
    </div>
  )
}

const thStyle: CSSProperties = {
  textAlign: 'right', fontSize: 10, color: '#6B7280', fontWeight: 500,
  padding: '0 10px 8px', letterSpacing: '0.5px', textTransform: 'uppercase',
}
const tdStyle: CSSProperties = { textAlign: 'right', fontSize: 13, padding: '10px' }

export default function USWatchlistPage() {
  const [quotes, setQuotes] = useState<USQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/api/us-watchlist')
      .then(r => r.json())
      .then(d => {
        setQuotes(d.quotes ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = quotes.filter(
    q => q.ticker.toLowerCase().includes(query.toLowerCase()) || q.companyName.includes(query)
  )

  return (
    <div className="p-4 md:p-6" style={{ minHeight: '100vh', background: '#0D0F14', color: '#E8E4D9' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>US Watchlist</h2>
          <p style={{ fontSize: 11, color: '#6B7280', margin: '4px 0 0', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            60 Tickers · Yahoo Finance
          </p>
          <input
            type="text"
            placeholder="銘柄名・ティッカーで検索"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              marginTop: 12, width: '100%', maxWidth: 320, padding: '8px 12px', fontSize: 13,
              background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: '#E8E4D9', outline: 'none',
            }}
          />
        </div>

        {loading ? (
          <div style={{ color: '#6B7280', fontSize: 13, textAlign: 'center', paddingTop: 60 }}>読み込み中...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ ...thStyle, textAlign: 'left' }}>銘柄</th>
                  <th style={thStyle}>出来高</th>
                  <th style={thStyle}>株価</th>
                  <th style={thStyle}>52週レンジ</th>
                  <th style={thStyle}>チャート / 前日比</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(q => (
                  <tr
                    key={q.ticker}
                    onClick={() => { window.location.href = `/watchlist/us/${q.ticker}` }}
                    style={{ cursor: 'pointer', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}
                  >
                    <td style={{ padding: '10px', textAlign: 'left' }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{q.ticker}</div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>{q.companyName}</div>
                    </td>
                    <td style={{ ...tdStyle, color: '#9CA3AF' }}>{formatVolume(q.volume)}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{q.price != null ? q.price.toFixed(2) : '—'}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Range52w price={q.price} high={q.fiftyTwoWeekHigh} low={q.fiftyTwoWeekLow} />
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <SparklineWithChange data={q.sparkline} changePct={q.changePct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
