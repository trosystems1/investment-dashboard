'use client'
import { useEffect, useState } from 'react'

type Position = {
  uic: number
  name: string
  amount: number
  avgOpenPrice: number
  pnl: number
  pnlPct: number
  pnlIntraday: number
  pnlJpy: number
  currency: string
  convRate: number
}

const fmtUSD = (v: number) =>
  (v >= 0 ? '+' : '-') + '$' + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 })

const fmtJPY = (v: number) =>
  (v >= 0 ? '+' : '-') + '¥' + Math.abs(v).toLocaleString('ja-JP', { maximumFractionDigits: 0 })

const fmtPct = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(1) + '%'

export default function SaxoPositions() {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [showJpy, setShowJpy] = useState(false)

  useEffect(() => {
    fetch('/api/saxo/positions')
      .then(r => r.json())
      .then(json => {
        setPositions(json.data || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ padding: '20px', color: '#4B5563', fontSize: 13 }}>Loading SAXO positions...</div>
  }
  if (!positions.length) return null

  const btn = (active: boolean) => ({
    fontSize: 11,
    padding: '3px 8px',
    borderRadius: 5,
    cursor: 'pointer' as const,
    border: 'none',
    background: active ? 'rgba(196,156,72,0.15)' : 'transparent',
    color: active ? '#C49C48' : '#6B7280',
  })

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(196,156,72,0.15)',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 24,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, color: '#B8B4A8', fontWeight: 500 }}>
          SAXO 保有ポジション
          <span style={{ fontSize: 11, color: '#4B5563', marginLeft: 8 }}>{positions.length}銘柄</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={btn(!showJpy)} onClick={() => setShowJpy(false)}>USD</button>
          <button style={btn(showJpy)} onClick={() => setShowJpy(true)}>JPY</button>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['銘柄', '数量', '取得単価', '損益', '損益率', '当日損益'].map(h => (
                <th
                  key={h}
                  style={{
                    padding: '6px 12px',
                    color: '#4B5563',
                    fontWeight: 500,
                    textAlign: h === '銘柄' ? 'left' : 'right',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map(pos => (
              <tr
                key={pos.uic}
                style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(196,156,72,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '8px 12px', color: '#C49C48' }}>{pos.name}</td>
                <td style={{ padding: '8px 12px', color: '#B8B4A8', textAlign: 'right' }}>{pos.amount}</td>
                <td style={{ padding: '8px 12px', color: '#B8B4A8', textAlign: 'right' }}>${pos.avgOpenPrice?.toFixed(2)}</td>
                <td
                  style={{
                    padding: '8px 12px',
                    textAlign: 'right',
                    color: pos.pnl >= 0 ? '#4ADE80' : '#F87171',
                    fontWeight: 500,
                  }}
                >
                  {showJpy ? fmtJPY(pos.pnlJpy) : fmtUSD(pos.pnl)}
                </td>
                <td
                  style={{
                    padding: '8px 12px',
                    textAlign: 'right',
                    color: pos.pnlPct >= 0 ? '#4ADE80' : '#F87171',
                  }}
                >
                  {fmtPct(pos.pnlPct)}
                </td>
                <td
                  style={{
                    padding: '8px 12px',
                    textAlign: 'right',
                    color: pos.pnlIntraday >= 0 ? '#4ADE80' : '#F87171',
                  }}
                >
                  {showJpy ? fmtJPY(pos.pnlIntraday * pos.convRate) : fmtUSD(pos.pnlIntraday)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
