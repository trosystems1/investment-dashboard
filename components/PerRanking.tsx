'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatJPYCompound } from '@/lib/format'

interface PerItem {
  ticker: string
  name: string
  per: number
  price: number
  eps: number
}

export default function PerRanking() {
  const [data, setData] = useState<PerItem[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/per-ranking')
      .then(r => r.json())
      .then(json => { setData(json.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ background: 'rgba(196,156,72,0.04)', border: '0.5px solid rgba(196,156,72,0.15)', borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 11, color: '#6B7280' }}>PERデータ読み込み中...</div>
    </div>
  )

  if (!data.length) return null

  return (
    <div style={{ background: 'rgba(196,156,72,0.04)', border: '0.5px solid rgba(196,156,72,0.15)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 12, color: '#C49C48', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 2 }}>予想PERランキング</div>
          <div style={{ fontSize: 10, color: '#4B5563' }}>株価 ÷ 予想EPS（高い順）</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map((item, i) => (
          <div
            key={item.ticker}
            onClick={() => router.push('/stock/' + encodeURIComponent(item.ticker))}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.02)',
              border: '0.5px solid rgba(255,255,255,0.06)',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(196,156,72,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: i === 0 ? '#F59E0B' : i === 1 ? '#9CA3AF' : i === 2 ? '#B45309' : '#4B5563', minWidth: 24, textAlign: 'center' }}>
              {i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: '#E8E4D9', marginBottom: 2 }}>{item.name}</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>
                {formatJPYCompound(item.price)}
                <span style={{ marginLeft: 8 }}>EPS ¥{item.eps.toFixed(1)}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#C49C48' }}>
                {item.per}倍
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}