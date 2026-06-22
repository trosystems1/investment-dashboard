'use client'
import { useEffect, useState } from 'react'

type HomeSummary = {
  configured: boolean
  date: string | null
  signals: {
    total: number
    stock: number
    crypto: number
    prevTotal: number | null
    delta: number | null
  }
  topix: {
    date: string
    close: number
    change: number
    changePct: number
  } | null
  nikkeiSummary: {
    date: string
    title: string | null
    content: string
  } | null
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })
}

export default function DailySummaryCard() {
  const [data, setData] = useState<HomeSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/home-summary')
      .then(r => r.json())
      .then(json => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)',
        borderRadius: 12, padding: 20, marginBottom: 16, color: '#4B5563', fontSize: 13,
      }}>
        前日サマリー読み込み中...
      </div>
    )
  }

  if (!data) return null

  const { signals, topix, nikkeiSummary } = data
  const topixUp = topix ? topix.change >= 0 : true
  const deltaUp = signals.delta != null ? signals.delta >= 0 : null

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)',
      borderRadius: 12, padding: 20, marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 13, color: '#B8B4A8', fontWeight: 500 }}>前日サマリー</span>
        <span style={{ fontSize: 11, color: '#4B5563' }}>{formatDate(data.date)}時点</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: nikkeiSummary ? 16 : 0 }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, color: '#6B7280', letterSpacing: '0.05em', marginBottom: 6 }}>シグナル検出件数</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 600, color: signals.total > 0 ? '#C49C48' : '#E8E4D9' }}>
              {signals.total}件
            </span>
            {signals.delta != null && signals.delta !== 0 && (
              <span style={{ fontSize: 12, color: deltaUp ? '#4ADE80' : '#F87171' }}>
                {deltaUp ? '▲' : '▼'}{Math.abs(signals.delta)}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
            株 {signals.stock}件 ・ Crypto {signals.crypto}件
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, color: '#6B7280', letterSpacing: '0.05em', marginBottom: 6 }}>TOPIX 前日終値</div>
          {topix ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 22, fontWeight: 600, color: '#E8E4D9' }}>{topix.close.toFixed(2)}</span>
              </div>
              <div style={{ fontSize: 12, marginTop: 4, color: topixUp ? '#4ADE80' : '#F87171' }}>
                {topixUp ? '+' : ''}{topix.change.toFixed(2)} （{topixUp ? '+' : ''}{topix.changePct.toFixed(2)}%）
              </div>
            </>
          ) : (
            <span style={{ fontSize: 12, color: '#4B5563' }}>データ取得不可</span>
          )}
        </div>
      </div>

      {nikkeiSummary && (
        <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
          <div style={{ fontSize: 10, color: '#6B7280', letterSpacing: '0.05em', marginBottom: 6 }}>
            日経225オプション朝サマリー
          </div>
          <p style={{ fontSize: 13, color: '#B8B4A8', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
            {nikkeiSummary.content.length > 140
              ? nikkeiSummary.content.slice(0, 140) + '…'
              : nikkeiSummary.content}
          </p>
          <a href="/analysis" style={{ fontSize: 11, color: '#818CF8', textDecoration: 'none', marginTop: 8, display: 'inline-block' }}>
            続きを見る →
          </a>
        </div>
      )}
    </div>
  )
}
