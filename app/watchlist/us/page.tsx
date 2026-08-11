'use client'

import { useEffect, useState } from 'react'

type USQuote = {
  ticker: string
  companyName: string
  sector: string
  price: number | null
  changePct: number | null
  sparkline: number[]
}

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  if (!data || data.length < 2) return <div style={{ width: 60, height: 24 }} />
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * 60},${24 - ((v - min) / range) * 24}`)
    .join(' ')
  return (
    <svg width="60" height="24" style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={up ? '#4ade80' : '#f87171'} strokeWidth="1.5" />
    </svg>
  )
}

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
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.map(q => {
              const up = (q.changePct ?? 0) >= 0
              return (
                <a
                  key={q.ticker}
                  href={`/watchlist/us/${q.ticker}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', textDecoration: 'none', color: 'inherit',
                    borderBottom: '0.5px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div style={{ minWidth: 140 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{q.ticker}</div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>{q.companyName}</div>
                  </div>
                  <Sparkline data={q.sparkline} up={up} />
                  <div style={{ textAlign: 'right', minWidth: 90 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{q.price != null ? q.price.toFixed(2) : '—'}</div>
                    <div
                      style={{
                        fontSize: 12, fontWeight: 700, marginTop: 2, padding: '1px 8px', borderRadius: 6,
                        display: 'inline-block',
                        background: q.changePct == null ? 'transparent' : up ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
                        color: q.changePct == null ? '#6B7280' : up ? '#4ade80' : '#f87171',
                      }}
                    >
                      {q.changePct != null ? `${up ? '+' : ''}${q.changePct}%` : '—'}
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
