'use client'

import { useEffect, useState, type CSSProperties } from 'react'

type USQuote = {
  ticker: string
  companyName: string
  sector: string
  price: number | null
  changePct: number | null
  volume: number | null
  marketCap: number | null
  sparkline: number[]
}

function formatMarketCap(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toLocaleString()}`
}

function formatVolume(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return `${v}`
}

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  if (!data || data.length < 2) return <div style={{ width: 50, height: 22 }} />
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * 50},${22 - ((v - min) / range) * 22}`)
    .join(' ')
  return (
    <svg width="50" height="22" style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={up ? '#4ade80' : '#f87171'} strokeWidth="1.5" />
    </svg>
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
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ ...thStyle, textAlign: 'left' }}>銘柄</th>
                  <th style={thStyle}>チャート</th>
                  <th style={thStyle}>時価総額</th>
                  <th style={thStyle}>出来高</th>
                  <th style={thStyle}>株価</th>
                  <th style={thStyle}>前日比</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(q => {
                  const up = (q.changePct ?? 0) >= 0
                  return (
                    <tr
                      key={q.ticker}
                      onClick={() => { window.location.href = `/watchlist/us/${q.ticker}` }}
                      style={{ cursor: 'pointer', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}
                    >
                      <td style={{ padding: '10px', textAlign: 'left' }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{q.ticker}</div>
                        <div style={{ fontSize: 11, color: '#6B7280' }}>{q.companyName}</div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <Sparkline data={q.sparkline} up={up} />
                        </div>
                      </td>
                      <td style={{ ...tdStyle, color: '#9CA3AF' }}>{formatMarketCap(q.marketCap)}</td>
                      <td style={{ ...tdStyle, color: '#9CA3AF' }}>{formatVolume(q.volume)}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{q.price != null ? q.price.toFixed(2) : '—'}</td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                            background: q.changePct == null ? 'transparent' : up ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
                            color: q.changePct == null ? '#6B7280' : up ? '#4ade80' : '#f87171',
                          }}
                        >
                          {q.changePct != null ? `${up ? '+' : ''}${q.changePct}%` : '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
