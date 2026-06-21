'use client'

import { useState, useEffect, useCallback } from 'react'
import StockTable from '@/components/StockTable'
import InvestorTypesChart from '@/components/InvestorTypesChart'
import TopixChart from '@/components/TopixChart'
import NenkinRanking from '@/components/NenkinRanking'
import PerRanking from '@/components/PerRanking'
import CryptoDashboard from '@/components/CryptoDashboard'

interface SignalRun {
  timestamp: string
  signalCount: number
  signals: string[]
  tickerCount: number
}

interface StockData {
  symbol: string; name: string; price: number
  change: number; changePct: number; currency: string
}

interface StockEntry { symbol: string; name: string; category: 'holding' | 'watch' }

const DEFAULT_STOCKS: StockEntry[] = [
  { symbol: '228A.T', name: 'opro',          category: 'holding' },
  { symbol: '4397.T', name: 'TeamSpirit',    category: 'holding' },
  { symbol: '4776.T', name: 'Cybozu',        category: 'holding' },
  { symbol: '4811.T', name: 'Dream Arts',    category: 'holding' },
  { symbol: '4374.T', name: 'ROBOT PAYMENT', category: 'watch'   },
  { symbol: '431A.T', name: 'Ysona',         category: 'watch'   },
  { symbol: '4443.T', name: 'Sansan',        category: 'watch'   },
  { symbol: '4478.T', name: 'freee',         category: 'watch'   },
  { symbol: '3994.T', name: 'MoneyForward',  category: 'watch'   },
  { symbol: '4058.T', name: 'Toyokumo',      category: 'watch'   },
]

const STORAGE_KEY = 'apex_stocks_v1'

function loadStocks(): StockEntry[] {
  if (typeof window === 'undefined') return DEFAULT_STOCKS
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    return s ? JSON.parse(s) : DEFAULT_STOCKS
  } catch { return DEFAULT_STOCKS }
}

function saveStocks(entries: StockEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

function normalizeCode(raw: string) {
  const code = raw.trim().toUpperCase().replace(/\.T$/i, '')
  return code ? code + '.T' : ''
}

export default function Dashboard() {
  const [entries, setEntries] = useState<StockEntry[]>(DEFAULT_STOCKS)
  const [prices, setPrices] = useState<StockData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState('')
  const [editing, setEditing] = useState(false)
  const [addCode, setAddCode] = useState('')
  const [addName, setAddName] = useState('')
  const [addCat, setAddCat] = useState<'holding' | 'watch'>('watch')
  const [addError, setAddError] = useState('')
  const [signalRun, setSignalRun] = useState<SignalRun | null>(null)

  useEffect(() => { setEntries(loadStocks()) }, [])

  useEffect(() => {
    fetch('/api/settings/signal')
      .then(r => r.json())
      .then(j => setSignalRun(j.lastRun))
      .catch(() => {})
  }, [])

  const fetchPrices = useCallback(async (list: StockEntry[]) => {
    if (!list.length) return
    try {
      const symbols = list.map(e => e.symbol).join(',')
      const res = await fetch('/api/stock?symbols=' + symbols)
      const json = await res.json()
      if (json.data) {
        const nameMap = Object.fromEntries(list.map(e => [e.symbol, e.name]))
        const merged = json.data.map((d: StockData) => ({ ...d, name: nameMap[d.symbol] || d.name }))
        setPrices(merged)
        setLastUpdated(new Date().toLocaleTimeString('ja-JP'))
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchPrices(entries)
    const t = setInterval(() => fetchPrices(entries), 60000)
    return () => clearInterval(t)
  }, [entries, fetchPrices])

  const holdings = entries.filter(e => e.category === 'holding')
  const watchlist = entries.filter(e => e.category === 'watch')
  const priceMap = Object.fromEntries(prices.map(p => [p.symbol, p]))
  const holdingPrices  = holdings.map(e => priceMap[e.symbol] ?? { symbol: e.symbol, name: e.name, price: 0, change: 0, changePct: 0, currency: 'JPY' })
  const watchlistPrices = watchlist.map(e => priceMap[e.symbol] ?? { symbol: e.symbol, name: e.name, price: 0, change: 0, changePct: 0, currency: 'JPY' })

  const handleAdd = () => {
    setAddError('')
    const symbol = normalizeCode(addCode)
    if (!symbol) { setAddError('コードを入力してください'); return }
    if (entries.some(e => e.symbol === symbol)) { setAddError('すでに登録されています'); return }
    const name = addName.trim() || symbol.replace('.T', '')
    const next = [...entries, { symbol, name, category: addCat }]
    setEntries(next); saveStocks(next)
    setAddCode(''); setAddName('')
  }

  const handleRemove = (symbol: string) => {
    const next = entries.filter(e => e.symbol !== symbol)
    setEntries(next); saveStocks(next)
  }

  const handleMove = (symbol: string) => {
    const next = entries.map(e =>
      e.symbol === symbol ? { ...e, category: e.category === 'holding' ? 'watch' : 'holding' } as StockEntry : e
    )
    setEntries(next); saveStocks(next)
  }

  return (
    <div className="p-4 md:p-6" style={{ minHeight: '100vh', background: '#0D0F14', fontFamily: 'var(--font-body)', color: '#E8E4D9' }}>
      <div style={{ position: 'fixed', top: -200, right: -200, width: 500, height: 500, background: 'radial-gradient(circle, rgba(196,156,72,0.06) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: -100, left: -100, width: 400, height: 400, background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto' }}>

        {/* ページヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#E8E4D9', margin: 0, letterSpacing: '-0.3px' }}>Market</h2>
            <p style={{ fontSize: 11, color: '#6B7280', margin: '4px 0 0', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Japanese Equity Overview</p>
            <div style={{ width: 32, height: 2, background: 'linear-gradient(to right, #C49C48, transparent)', borderRadius: 1, marginTop: 8 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {lastUpdated && <span style={{ fontSize: 11, color: '#4B5563' }}>更新: {lastUpdated}</span>}
            <button
              onClick={() => { setLoading(true); fetchPrices(entries) }}
              style={{ background: 'rgba(196,156,72,0.1)', border: '0.5px solid rgba(196,156,72,0.3)', padding: '6px 14px', borderRadius: 20, fontSize: 12, color: '#C49C48', cursor: 'pointer' }}
            >
              ↻ 更新
            </button>
            <button
              onClick={() => setEditing(v => !v)}
              style={{ background: editing ? 'rgba(196,156,72,0.15)' : 'rgba(255,255,255,0.04)', border: '0.5px solid ' + (editing ? 'rgba(196,156,72,0.4)' : 'rgba(255,255,255,0.1)'), padding: '6px 14px', borderRadius: 20, fontSize: 12, color: editing ? '#C49C48' : '#B8B4A8', cursor: 'pointer' }}
            >
              {editing ? '✓ 完了' : '✎ リスト編集'}
            </button>
          </div>
        </div>

        {signalRun && (
          <a href="/settings" style={{
            display: 'block',
            background: signalRun.signalCount > 0 ? 'rgba(196,156,72,0.06)' : 'rgba(255,255,255,0.02)',
            border: `0.5px solid ${signalRun.signalCount > 0 ? 'rgba(196,156,72,0.25)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 10,
            padding: signalRun.signalCount > 0 ? '14px 20px' : '12px 20px',
            marginBottom: 16,
            textDecoration: 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: signalRun.signalCount > 0 ? 8 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15 }}>{signalRun.signalCount > 0 ? '🔔' : '✓'}</span>
                <span style={{ fontSize: 15, color: signalRun.signalCount > 0 ? '#C49C48' : '#6B7280', fontWeight: 500 }}>
                  {signalRun.signalCount > 0 ? `シグナル検出 ${signalRun.signalCount}件` : 'シグナルなし'}
                </span>
                <span style={{ fontSize: 11, color: '#6B7280' }}>
                  {new Date(signalRun.timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {signalRun.tickerCount ? `　${signalRun.tickerCount}銘柄チェック` : ''}
                  　/　次回: 平日 朝9:00
                </span>
              </div>
              <span style={{ fontSize: 11, color: '#6B7280' }}>詳細 →</span>
            </div>
            {signalRun.signalCount > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {signalRun.signals.map((s, i) => (
                  <div key={i} style={{ fontSize: 14, color: '#B8B4A8', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {s}
                  </div>
                ))}
              </div>
            )}
          </a>
        )}

        {/* Crypto（bitFlyer） */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(129,140,248,0.2)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, color: '#B8B4A8', fontWeight: 500, margin: 0 }}>Crypto</h3>
            <p style={{ fontSize: 11, color: '#6B7280', margin: '4px 0 0', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
              bitFlyer · 5分足 RSI / 出来高
            </p>
          </div>
          <CryptoDashboard />
        </div>

        {/* 投資部門別 */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <InvestorTypesChart />
        </div>

        {/* TOPIX */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <TopixChart />
        </div>

        {/* 保有株 | ウォッチリスト */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['holding', 'watch'] as const).map(cat => {
            const label     = cat === 'holding' ? '保有株' : 'ウォッチリスト'
            const catList   = cat === 'holding' ? holdings : watchlist
            const catPrices = cat === 'holding' ? holdingPrices : watchlistPrices

            return (
              <div key={cat} style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 14, color: '#B8B4A8', fontWeight: 500, marginBottom: 16 }}>
                  {label} <span style={{ fontSize: 11, color: '#4B5563' }}>({catList.length} 銘柄)</span>
                </div>
                {editing ? (
                  <div>
                    {catList.map(e => (
                      <div key={e.symbol} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ fontSize: 13, color: '#E8E4D9', minWidth: 56 }}>{e.symbol.replace('.T', '')}</span>
                        <span style={{ flex: 1, fontSize: 11, color: '#6B7280' }}>{e.name}</span>
                        <button onClick={() => handleMove(e.symbol)}
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: '0.5px solid rgba(196,156,72,0.3)', background: 'transparent', color: '#C49C48', cursor: 'pointer' }}>
                          {cat === 'holding' ? '→ Watch' : '→ 保有'}
                        </button>
                        <button onClick={() => handleRemove(e.symbol)}
                          style={{ fontSize: 13, padding: '3px 7px', borderRadius: 5, border: '0.5px solid rgba(248,113,113,0.3)', background: 'transparent', color: '#F87171', cursor: 'pointer' }}>✕</button>
                      </div>
                    ))}
                    <div style={{ marginTop: 12, padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 8 }}>銘柄を追加</div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                        <input
                          value={addCat === cat ? addCode : ''}
                          onChange={e => { setAddCode(e.target.value); setAddCat(cat); setAddError('') }}
                          onFocus={() => setAddCat(cat)}
                          placeholder="証券コード（例: 4397）"
                          style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#E8E4D9', outline: 'none' }}
                          onKeyDown={e => { if (e.key === 'Enter' && addCat === cat) handleAdd() }}
                        />
                        <input
                          value={addCat === cat ? addName : ''}
                          onChange={e => { setAddName(e.target.value); setAddCat(cat) }}
                          onFocus={() => setAddCat(cat)}
                          placeholder="名前（省略可）"
                          style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#E8E4D9', outline: 'none' }}
                          onKeyDown={e => { if (e.key === 'Enter' && addCat === cat) handleAdd() }}
                        />
                        <button onClick={() => { setAddCat(cat); handleAdd() }}
                          style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: 'rgba(196,156,72,0.2)', color: '#C49C48', fontSize: 12, cursor: 'pointer' }}>追加</button>
                      </div>
                      {addError && addCat === cat && <div style={{ fontSize: 11, color: '#F87171' }}>{addError}</div>}
                    </div>
                  </div>
                ) : (
                  <StockTable stocks={catPrices} loading={loading} />
                )}
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <NenkinRanking />
          <PerRanking />
        </div>

      </div>
    </div>
  )
}
