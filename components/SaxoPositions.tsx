'use client'
import { useEffect, useState } from 'react'

type Position = {
  uic: number
  name: string
  amount: number
  pnl: number
  pnlIntraday: number
  currency: string
}

const fmtUSD = (v: number) =>
  (v >= 0 ? '+' : '') + '$' + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 })

export default function SaxoPositions() {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)

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
      <div style={{ fontSize: 14, color: '#B8B4A8', fontWeight: 500, marginBottom: 12 }}>
        SAXO 保有ポジション
        <span style={{ fontSize: 11, color: '#4B5563', marginLeft: 8 }}>{positions.length}銘柄</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['銘柄', '数量', '損益', '当日損益'].map(h => (
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
                <td
                  style={{
                    padding: '8px 12px',
                    textAlign: 'right',
                    color: pos.pnl >= 0 ? '#4ADE80' : '#F87171',
                    fontWeight: 500,
                  }}
                >
                  {fmtUSD(pos.pnl)}
                </td>
                <td
                  style={{
                    padding: '8px 12px',
                    textAlign: 'right',
                    color: pos.pnlIntraday >= 0 ? '#4ADE80' : '#F87171',
                  }}
                >
                  {fmtUSD(pos.pnlIntraday)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
