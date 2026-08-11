'use client'

import { useEffect, useState, type CSSProperties } from 'react'

type BenchmarkInsight = {
  analysisDate?: string
  channelName?: string
  videoTitle?: string
  focusThemes?: string
  sourceUrl?: string
}

type DailyRequest = {
  date?: string
  content?: string
  source?: string
}

function truncate(text: string, max: number): string {
  if (!text) return ''
  return text.length > max ? text.slice(0, max) + '…' : text
}

export default function EditorialPage() {
  const [insights, setInsights] = useState<BenchmarkInsight[]>([])
  const [nakajimaEntries, setNakajimaEntries] = useState<{ content: string }[]>([])
  const [requests, setRequests] = useState<DailyRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [expandedNakajima, setExpandedNakajima] = useState<number | null>(null)

  const loadAll = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/aria/benchmark-insights').then(r => r.json()).catch(() => ({ insights: [] })),
      fetch('/api/nakajima-digest').then(r => r.json()).catch(() => ({ entries: [] })),
      fetch('/api/aria/daily-input').then(r => r.json()).catch(() => ({ requests: [] })),
    ]).then(([bench, naka, req]) => {
      setInsights(bench.insights ?? [])
      setNakajimaEntries(naka.entries ?? [])
      setRequests(req.requests ?? [])
      setLoading(false)
    })
  }

  useEffect(() => {
    loadAll()
  }, [])

  const bacchama = insights.filter(i => (i.channelName || '').includes('ばっちゃま'))
  const asakura = insights.filter(i => !(i.channelName || '').includes('ばっちゃま'))

  const handleSubmit = async () => {
    if (!comment.trim()) return
    setSubmitting(true)
    try {
      await fetch('/api/aria/daily-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: comment.trim(), source: 'dashboard' }),
      })
      setComment('')
      loadAll()
    } finally {
      setSubmitting(false)
    }
  }

  const sectionStyle: CSSProperties = {
    background: 'rgba(255,255,255,0.02)',
    border: '0.5px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: '16px 18px',
  }
  const headerStyle: CSSProperties = {
    fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
  }
  const itemStyle: CSSProperties = {
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.015)',
    border: '0.5px solid rgba(255,255,255,0.04)',
    borderRadius: 8,
    marginBottom: 8,
  }

  return (
    <div className="p-4 md:p-6" style={{ minHeight: '100vh', background: '#0D0F14', color: '#E8E4D9' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>ARIA 編集デスク</h2>
          <p style={{ fontSize: 11, color: '#6B7280', margin: '4px 0 0', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            Editorial Desk
          </p>
          <p style={{ fontSize: 12, color: '#4B5563', marginTop: 8 }}>
            中島聡さん・ばっちゃま・朝倉慶さんの最新情報をまとめて確認し、ARIAへのリクエストやコメントをここから送れます。
          </p>
        </div>

        {/* コメント入力欄 */}
        <div style={{ ...sectionStyle, marginBottom: 20, borderColor: 'rgba(196,156,72,0.25)', background: 'rgba(196,156,72,0.05)' }}>
          <div style={headerStyle}>
            <span style={{ color: '#C49C48' }}>💬 ARIAへのコメント・リクエスト</span>
          </div>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="例：今日はNVIDIAの決算について詳しく触れてほしい、など"
            rows={3}
            style={{
              width: '100%', padding: '10px 12px', fontSize: 13, resize: 'vertical',
              background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: '#E8E4D9', outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={submitting || !comment.trim()}
            style={{
              marginTop: 10, padding: '8px 18px', fontSize: 13, fontWeight: 600,
              background: submitting ? 'rgba(196,156,72,0.3)' : '#C49C48', color: '#0D0F14',
              border: 'none', borderRadius: 8, cursor: submitting ? 'default' : 'pointer',
            }}
          >
            {submitting ? '送信中...' : '送信'}
          </button>

          {requests.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 8 }}>これまでのリクエスト</div>
              {requests.slice(0, 5).map((r, i) => (
                <div key={i} style={{ fontSize: 12, color: '#B8B4A8', padding: '6px 0', borderTop: i > 0 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <span style={{ color: '#4B5563', marginRight: 8 }}>{r.date}</span>
                  {r.content}
                </div>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ color: '#6B7280', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>読み込み中...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* 中島聡さん */}
            <div style={sectionStyle}>
              <div style={headerStyle}>
                <span style={{ color: '#818CF8' }}>📰 中島聡さん（週刊Life is beautiful）</span>
              </div>
              {nakajimaEntries.length === 0 ? (
                <div style={{ fontSize: 12, color: '#6B7280' }}>データがありません</div>
              ) : (
                nakajimaEntries.map((e, i) => (
                  <div key={i} style={itemStyle}>
                    <div style={{ fontSize: 13, color: '#E8E4D9', whiteSpace: 'pre-wrap' }}>
                      {expandedNakajima === i ? e.content : truncate(e.content, 300)}
                    </div>
                    {e.content.length > 300 && (
                      <button
                        onClick={() => setExpandedNakajima(expandedNakajima === i ? null : i)}
                        style={{ marginTop: 6, fontSize: 11, color: '#818CF8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        {expandedNakajima === i ? '閉じる' : 'もっと見る'}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* ばっちゃま */}
            <div style={sectionStyle}>
              <div style={headerStyle}>
                <span style={{ color: '#4ADE80' }}>🎥 ばっちゃま</span>
              </div>
              {bacchama.length === 0 ? (
                <div style={{ fontSize: 12, color: '#6B7280' }}>データがありません</div>
              ) : (
                bacchama.slice(0, 6).map((it, i) => (
                  <div key={i} style={itemStyle}>
                    <div style={{ fontSize: 11, color: '#4B5563', marginBottom: 4 }}>{it.analysisDate}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{it.videoTitle}</div>
                    <div style={{ fontSize: 12, color: '#B8B4A8' }}>{it.focusThemes}</div>
                  </div>
                ))
              )}
            </div>

            {/* 朝倉慶さん（投資アスクワン） */}
            <div style={sectionStyle}>
              <div style={headerStyle}>
                <span style={{ color: '#F87171' }}>🎥 朝倉慶さん（投資アスクワン）</span>
              </div>
              {asakura.length === 0 ? (
                <div style={{ fontSize: 12, color: '#6B7280' }}>データがありません</div>
              ) : (
                asakura.slice(0, 6).map((it, i) => (
                  <div key={i} style={itemStyle}>
                    <div style={{ fontSize: 11, color: '#4B5563', marginBottom: 4 }}>{it.analysisDate}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{it.videoTitle}</div>
                    <div style={{ fontSize: 12, color: '#B8B4A8' }}>{it.focusThemes}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
