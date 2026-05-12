'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface NenkinItem {
  name: string
  ticker: string | null
  currentCount: number
  prevCount: number
  changeCount: number
  changePct: number
  recordDate: string
}

export default function NenkinRanking() {
  const [data, setData] = useState<NenkinItem[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/nenkin-ranking')
      .then(r => r.json())
      .then(json => { setData(json.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ background: 'rgba(99,102,241,0.04)', border: '0.5px solid rgba(99,102,241,0.15)', borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 11, color: '#6B7280' }}>社員数データ読み込み中...</div>
    </div>
  )

  if (!data.length) return null

  return (
    <div style={{ background: 'rgba(99,102,241,0.04)', border: '0.5px solid rgba(99,102,241,0.15)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 12, color: '#818CF8', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 2 }}>社員数増減率ランキング</div>
          <div style={{ fontSize: 10, color: '#4B5563' }}>出典：日本年金機構（被保険者数）</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map((item, i) => (
          <div
            key={item.name}
            onClick={() => item.ticker && router.push('/stock/' + encodeURIComponent(item.ticker))}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.02)',
              border: '0.5px solid rgba(255,255,255,0.06)',
              cursor: item.ticker ? 'pointer' : 'default',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: i === 0 ? '#F59E0B' : i === 1 ? '#9CA3AF' : i === 2 ? '#B45309' : '#4B5563', minWidth: 24, textAlign: 'center' }}>
              {i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: '#E8E4D9', marginBottom: 2 }}>{item.name}</div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>
                {item.currentCount.toLocaleString()}人
                <span style={{ marginLeft: 8 }}>（前月 {item.prevCount.toLocaleString()}人）</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: item.changePct >= 0 ? '#4ADE80' : '#F87171' }}>
                {item.changePct >= 0 ? '+' : ''}{item.changePct}%
              </div>
              <div style={{ fontSize: 11, color: item.changeCount >= 0 ? '#4ADE80' : '#F87171' }}>
                {item.changeCount >= 0 ? '+' : ''}{item.changeCount.toLocaleString()}人
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
