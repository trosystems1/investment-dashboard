'use client'
import { useRouter } from 'next/navigation'

interface StockData { symbol: string; name: string; price: number; change: number; changePct: number; currency: string }
interface StockTableProps { stocks: StockData[]; loading: boolean }

function fmt(price: number, currency: string) {
  if (currency === 'JPY') return `¥${price.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}`
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function StockTable({ stocks, loading }: StockTableProps) {
  const router = useRouter()
  const isUp = (v: number) => v >= 0
  if (loading) return (<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[...Array(5)].map((_, i) => (<div key={i} style={{ height: 44, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }} />))}</div>)
  return (
    <div>
      {stocks.map((s) => {
        const clickable = s.symbol.endsWith('.T')
        retur (
          <div key={s.symbol} onClick={() => clickable && router.push(`/stock/${encodeURIComponent(s.symbol)}`)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 8px', borderBottom: '0.5px solid rgba(255,255,255,0.05)', cursor: clickable ? 'pointer' : 'default', borderRadius: 6, transition: 'background 0.15s' }}
            onMouseEnter={e => { if (clickable) (e.currentTarget as HTMLDivElement).style.background = 'rgba(196,156,72,0.06)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}>
            <div style={{ width: 56 }}><div style={{ fontSize: 13, fontWeight: 500, color: '#E8E4D9' }}>{s.symbol.replace('.T', '')}</div></div>
            <div style={{ flex: 1, fontSize: 11, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ textAlign: 'right', minWidth: 80 }}>
                <div style={{ fontSize: 13, color: '#E8E4D9' }}>{fmt(s.price, s.currency)}</div>
                <div style={{ fontSize: 11, color: isUp(s.changePct) ? '#4ADE80' : '#F87171' }}>{isUp(s.changePct) ? '+' : ''}{s.changePct.toFixed(2)}%</div>
              </div>
              {clickable && <div style={{ fontSize: 14, color: 'rgba(196,156,72,0.5)' }}>›</div>}
            </div>
          </div>
        )
      })}
      <div style={{ marginTop: 10, fontSize: 11, color: '#4B5563' }}>› 日本株をクリックで詳細表示</div>
    </div>
  )
}
