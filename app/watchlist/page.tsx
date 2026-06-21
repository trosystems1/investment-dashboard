'use client'

import { useState, useEffect } from 'react'
import CryptoCharts from '@/components/CryptoCharts'

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

type CryptoHistoryEntry = {
  timestamp: string
  rsi: number | null
  volumeRatio: number | null
  price: number | null
  triggered: boolean
  reason: string
  notified?: boolean
}

type CryptoPairStatus = {
  productCode: string
  price: number | null
  rsi: number | null
  volumeRatio: number | null
  candleCount: number
  lastSignal: { timestamp: string; message: string } | null
  history: CryptoHistoryEntry[]
  updatedAt: string | null
}

function formatCryptoPrice(productCode: string, price: number | null): string {
  if (price == null) return '—'
  if (productCode.endsWith('_JPY')) return `¥${Math.round(price).toLocaleString('ja-JP')}`
  return price.toLocaleString('ja-JP', { maximumFractionDigits: 8 })
}

function formatJST(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [cryptoStatuses, setCryptoStatuses] = useState<CryptoPairStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [cryptoLoading, setCryptoLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [cryptoExpanded, setCryptoExpanded] = useState<string | null>(null)
  const [signalsOnly, setSignalsOnly] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch('/api/watchlist')
      .then(r => r.json())
      .then(d => {
        setWatchlist(d.watchlist ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))

    fetch('/api/settings/crypto')
      .then(r => r.json())
      .then(d => {
        setCryptoStatuses(d.statuses ?? [])
        setCryptoLoading(false)
      })
      .catch(() => setCryptoLoading(false))
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

        <div style={{ marginTop: 48, marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#E8E4D9', margin: 0 }}>Crypto</h2>
          <p style={{ fontSize: 11, color: '#6B7280', margin: '4px 0 0', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            bitFlyer Signal
          </p>
          <p style={{ fontSize: 12, color: '#4B5563', marginTop: 8 }}>RSI・出来高シグナル（5分足）</p>
        </div>

        {cryptoLoading ? (
          <div style={{ color: '#4B5563', fontSize: 14, textAlign: 'center', paddingTop: 24 }}>読み込み中...</div>
        ) : cryptoStatuses.length === 0 ? (
          <div style={{ color: '#4B5563', fontSize: 14, textAlign: 'center', paddingTop: 24 }}>
            監視ペアが設定されていません。
            <br />
            <a href="/settings" style={{ color: '#818CF8', marginTop: 8, display: 'inline-block', fontSize: 13, textDecoration: 'none' }}>
              設定画面で追加する →
            </a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cryptoStatuses.map(item => {
              const latestSignal = item.history.find(h => h.triggered)
              const isExpanded = cryptoExpanded === item.productCode

              return (
                <div key={item.productCode} style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: `0.5px solid ${latestSignal ? 'rgba(129,140,248,0.3)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 12,
                  overflow: 'hidden',
                }}>
                  <div
                    onClick={() => setCryptoExpanded(isExpanded ? null : item.productCode)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }}
                  >
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#E8E4D9' }}>{item.productCode}</span>
                      <span style={{ fontSize: 11, color: '#818CF8', marginLeft: 8 }}>{formatCryptoPrice(item.productCode, item.price)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ textAlign: 'right', fontSize: 11, color: '#6B7280' }}>
                        <div>RSI {item.rsi ?? '—'}</div>
                        <div>Vol {item.volumeRatio != null ? `${item.volumeRatio}x` : '—'}</div>
                      </div>
                      {item.lastSignal ? (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: '#4B5563', marginBottom: 2 }}>{formatJST(item.lastSignal.timestamp)}</div>
                          <div style={{ fontSize: 12, color: '#818CF8' }}>🔔 通知済み</div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: '#4B5563' }}>シグナルなし</span>
                      )}
                      <span style={{ color: '#4B5563', fontSize: 11, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)', padding: '14px 18px' }}>
                      <CryptoCharts productCode={item.productCode} />
                      <p style={{ fontSize: 11, color: '#4B5563', margin: '0 0 12px' }}>
                        5分足 {item.candleCount}本
                        {item.updatedAt ? ` · 更新 ${formatJST(item.updatedAt)}` : ''}
                      </p>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontSize: 11, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                          シグナル履歴
                        </span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9CA3AF', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={signalsOnly[item.productCode] ?? false}
                            onChange={(e) =>
                              setSignalsOnly((prev) => ({ ...prev, [item.productCode]: e.target.checked }))
                            }
                          />
                          シグナルのみ
                        </label>
                      </div>

                      {item.history.length === 0 ? (
                        <p style={{ fontSize: 12, color: '#4B5563', margin: 0 }}>まだ履歴がありません。Cron実行後に表示されます。</p>
                      ) : (
                        <div
                          style={{
                            maxHeight: 320,
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                            paddingRight: 4,
                          }}
                        >
                          {(signalsOnly[item.productCode]
                            ? item.history.filter((h) => h.triggered)
                            : item.history.slice(0, 50)
                          ).map((entry, i) => (
                            <div
                              key={i}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '100px 1fr auto',
                                gap: 12,
                                alignItems: 'center',
                                padding: '8px 12px',
                                background: entry.triggered ? 'rgba(251,146,60,0.08)' : 'rgba(255,255,255,0.01)',
                                border: `0.5px solid ${entry.triggered ? 'rgba(251,146,60,0.25)' : 'rgba(255,255,255,0.04)'}`,
                                borderRadius: 8,
                                fontSize: 11,
                              }}
                            >
                              <span style={{ color: '#4B5563' }}>{formatJST(entry.timestamp)}</span>
                              <span style={{ color: '#9CA3AF' }}>
                                {formatCryptoPrice(item.productCode, entry.price)}
                                {' · '}RSI {entry.rsi ?? '—'}
                                {' · '}Vol {entry.volumeRatio != null ? `${entry.volumeRatio}x` : '—'}
                              </span>
                              <span style={{ color: entry.triggered ? '#FB923C' : '#4B5563', whiteSpace: 'nowrap' }}>
                                {entry.triggered ? `🔔${entry.notified ? ' LINE' : ''}` : '—'}
                              </span>
                            </div>
                          ))}
                          {(signalsOnly[item.productCode]
                            ? item.history.filter((h) => h.triggered).length === 0
                            : false) && (
                            <p style={{ fontSize: 12, color: '#4B5563', margin: 0, textAlign: 'center', padding: 12 }}>
                              シグナル履歴はありません
                            </p>
                          )}
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
