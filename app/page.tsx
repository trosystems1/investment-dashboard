'use client'

import { useState, useEffect, useCallback } from 'react'
import KpiCard from '@/components/KpiCard'
import StockTable from '@/components/StockTable'
import PerformanceChart from '@/components/PerformanceChart'
import AllocationChart from '@/components/AllocationChart'

interface StockData {
  symbol: string
  name: string
  price: number
  change: number
  changePct: number
  currency: string
}

const WATCHLIST = ['228A.T', '4397.T', '4374.T', '431A.T', '4443.T', '4478.T', '3994.T', '4776.T', '4058.T', '4811.T'];

export default function Dashboard() {
  const [stocks, setStocks] = useState<StockData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState('')
  const [chartSymbol, setChartSymbol] = useState('^N225')

  const fetchStocks = useCallback(async () => {
    try {
      const res = await fetch('/api/stock?symbols=' + WATCHLIST.join(','))
      const json = await res.json()
      if (json.data) {
        setStocks(json.data)
        setLastUpdated(new Date().toLocaleTimeString('ja-JP'))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStocks()
    const interval = setInterval(fetchStocks, 60000)
    return () => clearInterval(interval)
  }, [fetchStocks])

  const avgChange = stocks.length
    ? (stocks.reduce((s, x) => s + x.changePct, 0) / stocks.length).toFixed(2)
    : null

  return (
    <div style={{ minHeight: '100vh', background: '#0D0F14', padding: '24px', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#E8E4D9' }}>
      <div style={{ position: 'fixed', top: -200, right: -200, width: 500, height: 500, background: 'radial-gradient(circle, rgba(196,156,72,0.06) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: -100, left: -100, width: 400, height: 400, background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 28, margin: 0, color: '#E8E4D9', letterSpacing: '-0.5px' }}>APEX Portfolio</h1>
            <p style={{ fontSize: 11, color: '#6B7280', margin: '4px 0 0', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Private Wealth · Global Multi-Asset</p>
            <div style={{ width: 40, height: 2, background: 'linear-gradient(to right, #C49C48, transparent)', borderRadius: 1, marginTop: 8 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {lastUpdated && <span style={{ fontSize: 11, color: '#4B5563' }}>更新: {lastUpdated}</span>}
            <button onClick={fetchStocks} style={{ background: 'rgba(196,156,72,0.1)', border: '0.5px solid rgba(196,156,72,0.3)', padding: '6px 14px', borderRadius: 20, fontSize: 12, color: '#C49C48', cursor: 'pointer' }}>↻ 更新</button>
            <div style={{ background: 'rgba(196,156,72,0.08)', border: '0.5px solid rgba(196,156,72,0.2)', padding: '6px 14px', borderRadius: 20, fontSize: 12, color: '#C49C48' }}>{new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          <KpiCard label="Total Value" value="¥142.8M" badge="2.34% 前日比" badgeUp isGold />
          <KpiCard label="Day P&L" value="+¥3.26M" badge="本日損益" badgeUp />
          <KpiCard label="WL Avg Change" value={avgChange ? (parseFloat(avgChange) >= 0 ? '+' : '') + avgChange + '%' : '---'} badge="ウォッチリスト平均" badgeUp={!avgChange || parseFloat(avgChange) >= 0} />
          <KpiCard label="Sharpe Ratio" value="2.41" badge="リスク調整済" badgeUp />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, marginBottom: 16 }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
            <PerformanceChart symbol={chartSymbol} />
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
            <AllocationChart />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 14, color: '#B8B4A8', fontWeight: 500, marginBottom: 16 }}>ウォッチリスト <span style={{ fontSize: 11, color: '#4B5563' }}>({WATCHLIST.length} 銘柄)</span></div>
            <StockTable stocks={stocks} loading={loading} />
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 14, color: '#B8B4A8', fontWeight: 500, marginBottom: 16 }}>市場概況 <span style={{ fontSize: 11, color: '#C49C48' }}>クリックでチャート切替</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: '日経平均', symbol: '^N225', note: 'Japan' },
                { label: 'S&P 500', symbol: '^GSPC', note: 'US' },
                { label: 'USD/JPY', symbol: 'JPY=X', note: 'FX' },
                { label: 'Gold', symbol: 'GC=F', note: 'Commodity' },
                { label: 'BTC/USD', symbol: 'BTC-USD', note: 'Crypto' },
              ].map((item) => (
                <button key={item.symbol} onClick={() => setChartSymbol(item.symbol)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', borderRadius: 8, cursor: 'pointer', width: '100%',
                  border: chartSymbol === item.symbol ? '0.5px solid rgba(196,156,72,0.35)' : '0.5px solid rgba(255,255,255,0.05)',
                  background: chartSymbol === item.symbol ? 'rgba(196,156,72,0.06)' : 'rgba(255,255,255,0.02)',
                  textAlign: 'left',
                }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#E8E4D9', fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: '#4B5563' }}>{item.note}</div>
                  </div>
                  {chartSymbol === item.symbol && <div style={{ fontSize: 11, color: '#C49C48' }}>表示中 →</div>}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(196,156,72,0.05)', borderRadius: 8, border: '0.5px solid rgba(196,156,72,0.15)' }}>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>データソース</div>
              <div style={{ fontSize: 12, color: '#B8B4A8' }}>Yahoo Finance API · 60秒ごとに自動更新</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
