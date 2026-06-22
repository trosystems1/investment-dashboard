'use client'

import { useEffect, useState } from 'react'

type SummaryRow = {
  id: number
  date: string
  nikkei_close: number | null
  nikkei_change_pct: number | null
  nikkei_vi: number | null
  sp500_close: number | null
  sp500_change_pct: number | null
  vix_close: number | null
  usdjpy: number | null
  sq_days_remaining: number | null
  summary_text: string | null
  created_at: string
}

function fmtPct(v: number | null): string {
  if (v == null) return '—'
  return `${v >= 0 ? '+' : ''}${v}%`
}

function fmtNum(v: number | null, digits = 2): string {
  if (v == null) return '—'
  return v.toLocaleString('ja-JP', { maximumFractionDigits: digits })
}

export default function NikkeiMorningSummary() {
  const [rows, setRows] = useState<SummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/nikkei-morning-summary?limit=14')
      .then((r) => r.json())
      .then((d) => {
        setRows(d.summaries ?? [])
        setConfigured(d.configured !== false)
        setMessage(d.message ?? null)
      })
      .catch(() => setMessage('データの取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ color: '#6B7280', fontSize: 13, padding: 16 }}>
        朝サマリー読み込み中...
      </div>
    )
  }

  if (!configured) {
    return (
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16 }}>
        <p style={{ fontSize: 12, color: '#4B5563', margin: 0 }}>{message}</p>
      </div>
    )
  }

  const latest = rows[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 12, color: '#C49C48', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>
          日経225オプション 朝サマリー
        </div>
        <p style={{ fontSize: 10, color: '#4B5563', margin: 0 }}>
          毎朝7:00 JST に自動収集（Yahoo Finance + Gemini → Supabase）
        </p>
      </div>

      {!latest ? (
        <p style={{ fontSize: 12, color: '#4B5563', margin: 0 }}>
          まだデータがありません。Supabase テーブル作成後、<code style={{ color: '#9CA3AF' }}>/api/cron/nikkei-morning-summary</code> を実行してください。
        </p>
      ) : (
        <>
          <div
            style={{
              background: 'rgba(196,156,72,0.04)',
              border: '0.5px solid rgba(196,156,72,0.2)',
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#E8E4D9' }}>{latest.date}</span>
              <span style={{ fontSize: 11, color: '#6B7280' }}>
                SQまで {latest.sq_days_remaining ?? '—'} 営業日
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 10,
                marginBottom: 14,
                fontSize: 11,
              }}
            >
              <Metric label="日経平均" value={fmtNum(latest.nikkei_close, 0)} sub={fmtPct(latest.nikkei_change_pct)} />
              <Metric label="日経VI" value={fmtNum(latest.nikkei_vi, 1)} highlight={(latest.nikkei_vi ?? 0) >= 20} />
              <Metric label="S&P500" value={fmtNum(latest.sp500_close, 0)} sub={fmtPct(latest.sp500_change_pct)} />
              <Metric label="VIX" value={fmtNum(latest.vix_close, 1)} />
              <Metric label="USD/JPY" value={fmtNum(latest.usdjpy, 2)} />
            </div>

            <div style={{ fontSize: 13, color: '#B8B4A8', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {latest.summary_text}
            </div>
          </div>

          {rows.length > 1 && (
            <div>
              <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 8px', letterSpacing: '0.08em' }}>過去のサマリー</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rows.slice(1, 8).map((row) => (
                  <div
                    key={row.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.02)',
                      border: '0.5px solid rgba(255,255,255,0.05)',
                      fontSize: 11,
                    }}
                  >
                    <div style={{ color: '#9CA3AF', marginBottom: 4 }}>
                      {row.date} · 日経 {fmtPct(row.nikkei_change_pct)} · VI {fmtNum(row.nikkei_vi, 1)}
                    </div>
                    <div style={{ color: '#6B7280', lineHeight: 1.5 }}>
                      {(row.summary_text ?? '').split('\n').slice(0, 2).join(' ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Metric({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: boolean
}) {
  return (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: 8,
        background: highlight ? 'rgba(251,146,60,0.08)' : 'rgba(255,255,255,0.02)',
        border: `0.5px solid ${highlight ? 'rgba(251,146,60,0.25)' : 'rgba(255,255,255,0.05)'}`,
      }}
    >
      <div style={{ color: '#6B7280', marginBottom: 2 }}>{label}</div>
      <div style={{ color: highlight ? '#FB923C' : '#E8E4D9', fontWeight: 600 }}>{value}</div>
      {sub && <div style={{ color: '#9CA3AF', fontSize: 10, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
