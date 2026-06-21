'use client'

import { useEffect, useMemo, useState } from 'react'
import CryptoCharts from '@/components/CryptoCharts'

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
  return new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CryptoDashboard() {
  const [statuses, setStatuses] = useState<CryptoPairStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [signalsOnly, setSignalsOnly] = useState(false)

  useEffect(() => {
    fetch('/api/settings/crypto')
      .then((r) => r.json())
      .then((d) => setStatuses(d.statuses ?? []))
      .catch(() => setStatuses([]))
      .finally(() => setLoading(false))
  }, [])

  const hasSignal = useMemo(() => statuses.some((s) => s.history.some((h) => h.triggered)), [statuses])

  if (loading) {
    return (
      <div style={{ color: '#6B7280', fontSize: 13, textAlign: 'center', padding: 24 }}>
        Crypto データ読み込み中...
      </div>
    )
  }

  if (statuses.length === 0) {
    return (
      <div style={{ color: '#4B5563', fontSize: 13, textAlign: 'center', padding: 16 }}>
        監視ペアが設定されていません。
        <a href="/settings" style={{ color: '#818CF8', marginLeft: 8, textDecoration: 'none' }}>
          設定 →
        </a>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {statuses.map((item) => (
        <div key={item.productCode}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div>
              <span style={{ fontSize: 16, fontWeight: 600, color: '#E8E4D9' }}>{item.productCode}</span>
              <span style={{ fontSize: 13, color: '#818CF8', marginLeft: 10 }}>
                {formatCryptoPrice(item.productCode, item.price)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#9CA3AF' }}>
              <span>RSI {item.rsi ?? '—'}</span>
              <span>Vol {item.volumeRatio != null ? `${item.volumeRatio}x` : '—'}</span>
              <span>{item.candleCount}本</span>
              {item.updatedAt && <span>更新 {formatJST(item.updatedAt)}</span>}
            </div>
          </div>

          <CryptoCharts productCode={item.productCode} />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 8,
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: '#6B7280',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              シグナル履歴
            </span>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: '#9CA3AF',
                cursor: 'pointer',
              }}
            >
              <input type="checkbox" checked={signalsOnly} onChange={(e) => setSignalsOnly(e.target.checked)} />
              シグナルのみ
            </label>
          </div>

          {item.history.length === 0 ? (
            <p style={{ fontSize: 12, color: '#4B5563', margin: 0 }}>
              まだ履歴がありません。Cron実行後に表示されます。
            </p>
          ) : (
            <div
              style={{
                maxHeight: 280,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {(signalsOnly ? item.history.filter((h) => h.triggered) : item.history.slice(0, 50)).map(
                (entry, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '110px 1fr auto',
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
                      {entry.triggered && (
                        <span style={{ color: '#FB923C', marginLeft: 6 }}>{entry.reason}</span>
                      )}
                    </span>
                    <span style={{ color: entry.triggered ? '#FB923C' : '#4B5563', whiteSpace: 'nowrap' }}>
                      {entry.triggered ? `🔔${entry.notified ? ' LINE' : ''}` : '—'}
                    </span>
                  </div>
                ),
              )}
              {signalsOnly && item.history.filter((h) => h.triggered).length === 0 && (
                <p style={{ fontSize: 12, color: '#4B5563', margin: 0, textAlign: 'center', padding: 12 }}>
                  シグナル履歴はありません
                </p>
              )}
            </div>
          )}
        </div>
      ))}

      {!hasSignal && statuses.every((s) => s.candleCount === 0) && (
        <p style={{ fontSize: 11, color: '#4B5563', margin: 0, textAlign: 'center' }}>
          5分足データは Cron 実行後に蓄積されます（cron-job.org → /api/cron/crypto-signal）
        </p>
      )}
    </div>
  )
}
