'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type USQuote = {
  ticker: string
  companyName: string
  sector: string
  price: number | null
  changePct: number | null
  sparkline: number[]
}

function BigChart({ data, up }: { data: number[]; up: boolean }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const W = 700
  const H = 200
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`)
    .join(' ')
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={up ? '#4ade80' : '#f87171'} strokeWidth="2" />
    </svg>
  )
}

export default function USTickerDetailPage() {
  const params = useParams()
  const ticker = String(params.ticker ?? '').toUpperCase()
  const [quote, setQuote] = useState<USQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

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
            <div style={{ marginTop: 20, marginBottom: 28 }}>
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
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '20px 16px', marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 12, letterSpacing: '1px', textTransform: 'uppercase' }}>
                直近の値動き
              </div>
              {quote.sparkline.length >= 2 ? (
                <BigChart data={quote.sparkline} up={!!up} />
              ) : (
                <div style={{ fontSize: 12, color: '#4B5563' }}>チャートデータがありません</div>
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
