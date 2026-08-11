'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

const RANGES = ['1mo', '3mo', '6mo', '1y'] as const
type Range = typeof RANGES[number]
const RANGE_LABELS: Record<Range, string> = { '1mo': '1M', '3mo': '3M', '6mo': '6M', '1y': '1Y' }

const FONT_BODY = 'var(--font-body)' as const
const fmt = (n: number | null) => n?.toLocaleString() ?? '-'

type USQuote = {
  ticker: string
  companyName: string
  sector: string
  price: number | null
  open: number | null
  change: number | null
  changePct: number | null
  volume: number | null
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
  dayHigh: number | null
  dayLow: number | null
  sparkline: number[]
}

type ChartPoint = { date: string; value: number }

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'rgba(13,15,20,0.95)', border: '0.5px solid rgba(196,156,72,0.3)', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
      <div style={{ color: '#6B7280', marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#C49C48', fontWeight: 500 }}>${payload[0].value?.toLocaleString()}</div>
    </div>
  )
}

function WaterLevel({ pct }: { pct: number }) {
  const color = pct >= 70 ? '#F87171' : pct >= 40 ? '#C49C48' : '#4ADE80'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ fontSize: 10, color: '#6B7280', letterSpacing: '1px', textTransform: 'uppercase' }}>52W</div>
      <div style={{ position: 'relative', width: 48, height: 120, background: 'rgba(255,255,255,0.06)', borderRadius: 24, overflow: 'hidden', border: '0.5px solid rgba(255,255,255,0.1)' }}>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: pct + '%', background: 'linear-gradient(to top,' + color + '99,' + color + '44)', transition: 'height 1s ease' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#E8E4D9' }}>{pct}%</span>
        </div>
      </div>
      <div style={{ fontSize: 11, color: color, fontWeight: 500 }}>{pct >= 70 ? 'High' : pct >= 40 ? 'Mid' : 'Low'}</div>
    </div>
  )
}

function Card({ label, value, sub, gold }: { label: string; value: string; sub?: string; gold?: boolean }) {
  return (
    <div style={{ background: gold ? 'rgba(196,156,72,0.06)' : 'rgba(255,255,255,0.03)', border: '0.5px solid ' + (gold ? 'rgba(196,156,72,0.25)' : 'rgba(255,255,255,0.07)'), borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, color: '#6B7280', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontFamily: FONT_BODY, color: gold ? '#C49C48' : '#E8E4D9' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function USStockPage() {
  const params = useParams()
  const router = useRouter()
  const ticker = String(params.ticker ?? '').toUpperCase()
  const [quote, setQuote] = useState<USQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [range, setRange] = useState<Range>('3mo')
  const [chartPoints, setChartPoints] = useState<ChartPoint[]>([])
  const [chartLoading, setChartLoading] = useState(true)

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    fetch(`/api/us-watchlist/${ticker}`)
      .then(async r => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return }
        const d = await r.json()
        setQuote(d.quote ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [ticker])

  useEffect(() => {
    if (!ticker) return
    setChartLoading(true)
    fetch(`/api/us-watchlist/${ticker}/chart?range=${range}`)
      .then(r => r.json())
      .then(d => { setChartPoints(d.points ?? []); setChartLoading(false) })
      .catch(() => setChartLoading(false))
  }, [ticker, range])

  const isUp = quote ? (quote.changePct ?? 0) >= 0 : true
  const waterLevel = quote && quote.price != null && quote.fiftyTwoWeekHigh != null && quote.fiftyTwoWeekLow != null && quote.fiftyTwoWeekHigh > quote.fiftyTwoWeekLow
    ? Math.round(Math.min(100, Math.max(0, ((quote.price - quote.fiftyTwoWeekLow) / (quote.fiftyTwoWeekHigh - quote.fiftyTwoWeekLow)) * 100)))
    : null

  return (
    <div className="p-4 md:p-5" style={{ minHeight: '100vh', background: '#0D0F14', fontFamily: 'var(--font-body)', color: '#E8E4D9' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        <div className="flex flex-wrap items-center gap-3 md:gap-4 mb-6">
          <button onClick={() => router.push('/watchlist/us')} style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 14px', color: '#B8B4A8', cursor: 'pointer', fontSize: 13 }}>← Back</button>
          {!loading && quote && (
            <div className="flex flex-wrap items-baseline gap-2 md:gap-3 min-w-0">
              <h1 className="text-xl md:text-2xl" style={{ fontFamily: FONT_BODY, margin: 0, color: '#E8E4D9', letterSpacing: '-0.5px', fontWeight: 600 }}>{quote.companyName}</h1>
              <span style={{ fontSize: 13, color: '#6B7280' }}>{quote.ticker}</span>
              <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: 'rgba(196,156,72,0.1)', color: '#C49C48' }}>{quote.sector}</span>
            </div>
          )}
        </div>

        {loading && <div style={{ color: '#6B7280', textAlign: 'center', paddingTop: 80 }}>Loading...</div>}
        {!loading && (notFound || !quote) && <div style={{ color: '#6B7280', textAlign: 'center', paddingTop: 80 }}>銘柄「{ticker}」が見つかりませんでした。</div>}

        {!loading && quote && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div className="flex flex-wrap items-end gap-3 md:gap-4">
              <div className="text-3xl md:text-[40px]" style={{ fontFamily: FONT_BODY, color: '#C49C48', lineHeight: 1 }}>${fmt(quote.price)}</div>
              {quote.changePct != null && (
                <div style={{ fontSize: 15, padding: '4px 12px', borderRadius: 12, background: isUp ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: isUp ? '#4ADE80' : '#F87171' }}>
                  {isUp ? '+' : ''}{fmt(quote.change)} ({isUp ? '+' : ''}{quote.changePct?.toFixed(2)}%)
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <Card label="始値" value={quote.open != null ? '$' + fmt(quote.open) : '-'} />
              <Card label="高値" value={quote.dayHigh != null ? '$' + fmt(quote.dayHigh) : '-'} gold />
              <Card label="安値" value={quote.dayLow != null ? '$' + fmt(quote.dayLow) : '-'} />
              <Card label="出来高" value={quote.volume != null ? fmt(quote.volume) + '株' : '-'} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_80px] gap-4">
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: '#B8B4A8' }}>株価チャート</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {RANGES.map(r => (
                      <button key={r} onClick={() => setRange(r)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: 'none', background: range === r ? 'rgba(196,156,72,0.15)' : 'transparent', color: range === r ? '#C49C48' : '#6B7280' }}>{RANGE_LABELS[r]}</button>
                    ))}
                  </div>
                </div>
                {chartLoading ? (
                  <div style={{ color: '#6B7280', fontSize: 12, textAlign: 'center', padding: '80px 0' }}>読み込み中...</div>
                ) : chartPoints.length < 2 ? (
                  <div style={{ color: '#6B7280', fontSize: 12, textAlign: 'center', padding: '80px 0' }}>チャートデータがありません</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartPoints} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="gUS" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#C49C48" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#C49C48" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#4B5563', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: '#4B5563', fontSize: 10 }} tickLine={false} axisLine={false} width={55} tickFormatter={v => '$' + v.toLocaleString()} domain={['auto', 'auto']} />
                      <Tooltip content={<Tip />} />
                      {quote.fiftyTwoWeekHigh != null && <ReferenceLine y={quote.fiftyTwoWeekHigh} stroke="rgba(248,113,113,0.3)" strokeDasharray="3 3" />}
                      {quote.fiftyTwoWeekLow != null && <ReferenceLine y={quote.fiftyTwoWeekLow} stroke="rgba(74,222,128,0.3)" strokeDasharray="3 3" />}
                      <Area type="monotone" dataKey="value" stroke="#C49C48" strokeWidth={2} fill="url(#gUS)" dot={false} activeDot={{ r: 4, fill: '#C49C48', strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
                {waterLevel != null && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: '#4ADE80' }}>安値 ${fmt(quote.fiftyTwoWeekLow)}</span>
                      <span style={{ fontSize: 11, color: '#6B7280' }}>現在 ${fmt(quote.price)}</span>
                      <span style={{ fontSize: 11, color: '#F87171' }}>高値 ${fmt(quote.fiftyTwoWeekHigh)}</span>
                    </div>
                    <div style={{ position: 'relative', height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: waterLevel + '%', background: 'linear-gradient(to right, #4ADE80, #C49C48, #F87171)', borderRadius: 3 }} />
                      <div style={{ position: 'absolute', top: -3, left: waterLevel + '%', transform: 'translateX(-50%)', width: 12, height: 12, borderRadius: '50%', background: '#E8E4D9', border: '2px solid #0D0F14' }} />
                    </div>
                  </div>
                )}
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {waterLevel != null ? <WaterLevel pct={waterLevel} /> : <span style={{ fontSize: 11, color: '#6B7280' }}>—</span>}
              </div>
            </div>

            <div style={{ fontSize: 12, color: '#4B5563', textAlign: 'center', marginTop: 8 }}>
              決算反応パターンなどの詳細分析は今後追加予定です
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
