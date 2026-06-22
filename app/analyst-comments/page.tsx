'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { SOURCE_LABELS, type AnalystCommentSource } from '@/lib/analyst-comments'

type CommentRow = {
  id: number
  source: AnalystCommentSource
  comment_date: string
  title: string | null
  content: string
  metadata: Record<string, unknown> | null
  created_at: string
}

const TABS: Array<{ key: AnalystCommentSource | 'all'; label: string }> = [
  { key: 'all', label: 'すべて' },
  { key: 'nikkei_option', label: '日経225' },
  { key: 'stock_signal', label: '株式' },
  { key: 'crypto_signal', label: '仮想通貨' },
]

const PAGE_SIZE = 20

const tabStyle = (active: boolean): CSSProperties => ({
  fontSize: 11,
  padding: '6px 14px',
  borderRadius: 8,
  cursor: 'pointer',
  border: 'none',
  background: active ? 'rgba(196,156,72,0.15)' : 'transparent',
  color: active ? '#C49C48' : '#6B7280',
})

const sourceBadgeStyle = (source: AnalystCommentSource): CSSProperties => {
  const colors: Record<AnalystCommentSource, string> = {
    nikkei_option: '#818CF8',
    stock_signal: '#C49C48',
    crypto_signal: '#4ADE80',
  }
  return {
    fontSize: 10,
    padding: '2px 8px',
    borderRadius: 6,
    color: colors[source],
    background: `${colors[source]}18`,
    border: `0.5px solid ${colors[source]}40`,
    whiteSpace: 'nowrap',
  }
}

export default function AnalystCommentsPage() {
  const [source, setSource] = useState<AnalystCommentSource | 'all'>('all')
  const [comments, setComments] = useState<CommentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [configured, setConfigured] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  const fetchPage = useCallback(
    async (nextOffset: number, append: boolean) => {
      const params = new URLSearchParams({
        source,
        limit: String(PAGE_SIZE),
        offset: String(nextOffset),
      })
      const res = await fetch(`/api/analyst-comments?${params}`)
      const data = await res.json()
      setConfigured(data.configured !== false)
      setMessage(data.message ?? null)
      const rows = (data.comments ?? []) as CommentRow[]
      setComments((prev) => (append ? [...prev, ...rows] : rows))
      setHasMore(Boolean(data.hasMore))
      setOffset(nextOffset + rows.length)
    },
    [source],
  )

  useEffect(() => {
    setLoading(true)
    setOffset(0)
    fetchPage(0, false).finally(() => setLoading(false))
  }, [fetchPage])

  const loadMore = async () => {
    setLoadingMore(true)
    await fetchPage(offset, true)
    setLoadingMore(false)
  }

  return (
    <div className="p-4 md:p-6" style={{ minHeight: '100vh', background: '#0D0F14', color: '#E8E4D9' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>アナリストコメント</h2>
          <p style={{ fontSize: 11, color: '#6B7280', margin: '4px 0 0', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            Analyst Comments Archive
          </p>
          <p style={{ fontSize: 12, color: '#4B5563', marginTop: 8 }}>
            日経225朝サマリー・株式シグナル・仮想通貨シグナルを時系列で振り返る
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              style={tabStyle(source === tab.key)}
              onClick={() => setSource(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ color: '#6B7280', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>読み込み中...</div>
        ) : !configured ? (
          <p style={{ fontSize: 12, color: '#4B5563' }}>{message}</p>
        ) : comments.length === 0 ? (
          <p style={{ fontSize: 12, color: '#4B5563', textAlign: 'center', paddingTop: 40 }}>
            コメントがまだありません。各 Cron 実行後に蓄積されます。
            <br />
            <span style={{ fontSize: 11, color: '#6B7280' }}>
              過去分は <code>scripts/backfill-analyst-comments.ts</code> で投入できます。
            </span>
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {comments.map((c) => (
              <article
                key={c.id}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '0.5px solid rgba(255,255,255,0.07)',
                  borderRadius: 12,
                  padding: '16px 18px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                  <div>
                    <span style={sourceBadgeStyle(c.source)}>{SOURCE_LABELS[c.source]}</span>
                    {c.title && (
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#E8E4D9', marginTop: 8 }}>{c.title}</div>
                    )}
                  </div>
                  <time style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>{c.comment_date}</time>
                </div>
                <div style={{ fontSize: 13, color: '#B8B4A8', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{c.content}</div>
              </article>
            ))}

            {hasMore && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                style={{
                  margin: '8px auto 24px',
                  padding: '10px 24px',
                  borderRadius: 8,
                  border: '0.5px solid rgba(196,156,72,0.3)',
                  background: 'rgba(196,156,72,0.08)',
                  color: '#C49C48',
                  fontSize: 12,
                  cursor: loadingMore ? 'wait' : 'pointer',
                }}
              >
                {loadingMore ? '読み込み中...' : 'さらに読み込む'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
