'use client'

import { useEffect, useState } from 'react'

type Mention = {
  mentionDate: string
  ticker: string
  source: string
  note: string
  loggedAt: string
}

const SOURCE_LABELS: Record<string, string> = {
  benchmark: '競合チャンネル',
  nakajima: '中島聡さんメルマガ',
  news: 'ARIA Research',
}

const SOURCE_COLORS: Record<string, string> = {
  benchmark: '#818CF8',
  nakajima: '#C49C48',
  news: '#4ADE80',
}

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] || source || '不明'
}

function sourceColor(source: string): string {
  return SOURCE_COLORS[source] || '#6B7280'
}

function formatDate(mention: Mention): string {
  if (mention.mentionDate) return mention.mentionDate
  if (mention.loggedAt) return mention.loggedAt.slice(0, 10) + '（記録日）'
  return '日付不明'
}

export default function StockMentionsPage() {
  const [mentions, setMentions] = useState<Mention[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/api/stock-mentions')
      .then(r => r.json())
      .then(d => {
        setMentions(d.mentions ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = query
    ? mentions.filter(m => m.ticker.toLowerCase().includes(query.toLowerCase()))
    : mentions

  const grouped = filtered.reduce<Record<string, Mention[]>>((acc, m) => {
    const key = m.ticker || '不明'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  const tickers = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length)

  return (
    <div className="p-4 md:p-6" style={{ minHeight: '100vh', background: '#0D0F14', color: '#E8E4D9' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>銘柄別 言及履歴</h2>
          <p style={{ fontSize: 11, color: '#6B7280', margin: '4px 0 0', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            Stock Mentions Archive
          </p>
          <p style={{ fontSize: 12, color: '#4B5563', marginTop: 8 }}>
            競合チャンネル・中島聡さんのメルマガ・ARIA Researchの3つの情報源から、ARIAが個別銘柄について見つけた言及を毎日蓄積しています。
          </p>
          <input
            type="text"
            placeholder="ティッカーで絞り込み（例: NVDA）"
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
        ) : tickers.length === 0 ? (
          <div style={{ color: '#6B7280', fontSize: 13, textAlign: 'center', paddingTop: 60 }}>
            まだ言及の記録がありません。ARIAの動画生成が実行されると、ここに蓄積されていきます。
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {tickers.map(ticker => (
              <div key={ticker} style={{
                background: 'rgba(255,255,255,0.02)',
                border: '0.5px solid rgba(255,255,255,0.07)',
                borderRadius: 12,
                padding: '16px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#C49C48' }}>{ticker}</span>
                  <span style={{ fontSize: 11, color: '#6B7280' }}>{grouped[ticker].length}件の言及</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {grouped[ticker]
                    .slice()
                    .sort((a, b) => (b.mentionDate || b.loggedAt || '').localeCompare(a.mentionDate || a.loggedAt || ''))
                    .map((m, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: 12, padding: '10px 12px',
                        background: 'rgba(255,255,255,0.015)',
                        border: '0.5px solid rgba(255,255,255,0.04)',
                        borderRadius: 8,
                      }}>
                        <div style={{ fontSize: 11, color: '#4B5563', flexShrink: 0, minWidth: 90 }}>
                          {formatDate(m)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 5, marginRight: 8,
                            background: `${sourceColor(m.source)}22`, color: sourceColor(m.source),
                          }}>
                           {sourceLabel(m.source)}
                          </span>
                          <span style={{ fontSize: 13, color: '#E8E4D9' }}>{m.note}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
