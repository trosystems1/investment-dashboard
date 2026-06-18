'use client'

import { useState, useEffect } from 'react'

type HistoryEntry = {
  date: string
  signals: string[]
  checkedAt: string
}

type WatchlistItem = {
  ticker: string
  companyName: string
  history: HistoryEntry[]
}

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/watchlist')
      .then(r => r.json())
      .then(d => {
        setWatchlist(d.watchlist ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const getLatestSignal = (history: HistoryEntry[]) => {
    for (const entry of history) {
      if (entry.signals.length > 0) return { date: entry.date, signals: entry.signals }
    }
    return null
  }

  return (
    <div className="p-4 md:p-6" style={{ minHeight: '100vh', background: '#0D0F14', color: '#E8E4D9' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#E8E4D9', margin: 0 }}>Watchlist</h2>
          <p style={{ fontSize: 11, color: '#6B7280', margin: '4px 0 0', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            Signal History
          </p>
          <p style={{ fontSize: 12, color: '#4B5563', marginTop: 8 }}>銘柄ごとのシグナル検出履歴</p>
        </div>

        {loading ? (
          <div style={{ color: '#4B5563', fontSize: 14, textAlign: 'center', paddingTop: 60 }}>読み込み中...</div>
        ) : watchlist.length === 0 ? (
          <div style={{ color: '#4B5563', fontSize: 14, textAlign: 'center', paddingTop: 60 }}>
            ウォッチリストに銘柄が登録されていません。
            <br />
            <a href="/settings" style={{ color: '#C49C48', marginTop: 8, display: 'inline-block', fontSize: 13, textDecoration: 'none' }}>
              設定画面で追加する →
            </a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {watchlist.map(item => {
              const latest = getLatestSignal(item.history)
              const isExpanded = expanded === item.ticker

              return (
                <div key={item.ticker} style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: `0.5px solid ${latest ? 'rgba(196,156,72,0.3)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 12,
                  overflow: 'hidden',
                }}>
                  <div
                    onClick={() => setExpanded(isExpanded ? null : item.ticker)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }}
                  >
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#E8E4D9' }}>{item.companyName}</span>
                      <span style={{ fontSize: 11, color: '#C49C48', marginLeft: 8 }}>{item.ticker}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {latest ? (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: '#4B5563', marginBottom: 2 }}>{latest.date}</div>
                          <div style={{ fontSize: 12, color: '#C49C48' }}>🔔 {latest.signals.length}件のシグナル</div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: '#4B5563' }}>シグナル履歴なし</span>
                      )}
                      <span style={{ color: '#4B5563', fontSize: 11, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)', padding: '14px 18px' }}>
                      {item.history.length === 0 ? (
                        <p style={{ fontSize: 12, color: '#4B5563', margin: 0 }}>まだ履歴がありません。次回のCron実行後に表示されます。</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {item.history.map((entry, i) => (
                            <div key={i} style={{
                              display: 'flex', gap: 16, padding: '10px 14px',
                              background: entry.signals.length > 0 ? 'rgba(196,156,72,0.05)' : 'rgba(255,255,255,0.01)',
                              border: `0.5px solid ${entry.signals.length > 0 ? 'rgba(196,156,72,0.15)' : 'rgba(255,255,255,0.04)'}`,
                              borderRadius: 8,
                            }}>
                              <div style={{ fontSize: 11, color: '#4B5563', flexShrink: 0, minWidth: 80 }}>{entry.date}</div>
                              <div style={{ flex: 1 }}>
                                {entry.signals.length > 0 ? (
                                  entry.signals.map((sig, j) => (
                                    <div key={j} style={{ fontSize: 12, color: '#C49C48', lineHeight: 1.6 }}>🔔 {sig}</div>
                                  ))
                                ) : (
                                  <span style={{ fontSize: 12, color: '#4B5563' }}>✓ シグナルなし</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
