'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

const RANGES = ['1mo', '3mo', '6mo', '1y'] as const
type Range = typeof RANGES[number]
const RANGE_LABELS: Record<Range, string> = { '1mo': '1M', '3mo': '3M', '6mo': '6M', '1y': '1Y' }

const fmt = (n: number) => n?.toLocaleString() ?? '-'
const fmtB = (n: number) => n ? (n / 100000000).toFixed(1) + '億' : '-'

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'rgba(13,15,20,0.95)', border: '0.5px solid rgba(196,156,72,0.3)', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
      <div style={{ color: '#6B7280', marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#C49C48', fontWeight: 500 }}>¥yload[0].value?.toLocaleString()}</div>
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
      <div style={{ fontSize: 18, fontFamily: 'Georgia, serif', color: gold ? '#C49C48' : '#E8E4D9' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function StockPage() {
  const params = useParams()
  const router = useRouter()
  const ticker = decodeURIComponent(params.ticker as string)
  const [data, setData] = useState<any>(null)
  const [range, setRange] = useState<Range>('3mo')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch('/api/stock-detail?ticker=' + encodeURIComponent(ticker) + '&range=' + range)
      .then(r => r.json()).then(json => { setData(json); setLoading(false) }).catch(() => setLoading(false))
  }, [ticker, range])

  const isUp = data ? data.changePct >= 0 : true

  return (
    <div style={{ minHeight: '100vh', background: '#0D0F14', padding: '20px', fontFamily: 'system-ui, sans-serif', color: '#E8E4D9' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <button onClick={() => router.push('/')} style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 14px', color: '#B8B4A8', cursor: 'pointer', fontSize: 13 }}>← Back</button>
          {!loading && data && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, margin: 0 }}>{data.name}</h1>
              <span style={{ fontSize: 13, color: '#6B7280' }}>{ticker}</span>
              {data.finPeriod && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: 'rgba(196,156,72,0.1)', color: '#C49C48' }}>{data.finPeriod} {data.finDate}</span>}
            </div>
          )}
        </div>

        {loading && <div style={{ color: '#6B7280', textAlign: 'center', paddingTop: 80 }}>Loading...</div>}

        {!loading && data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 40, color: '#C49C48', lineHeight: 1 }}>¥{fmt(data.price)}</div>
              <div style={{ fontSize: 15, padding: '4px 12px', borderRadius: 12, background: isUp  'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: isUp ? '#4ADE80' : '#F87171' }}>
                {isUp ? '+' : ''}{fmt(data.change)} ({isUp ? '+' : ''}{data.changePct?.toFixed(2)}%)
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <Card label="始値" value={'¥' + fmt(data.open)} />
              <Card label="高値" value={'¥' + fmt(data.high)} gold />
              <Card label="安値" value={'¥' + fmt(data.low)} />
              <Card label="出来高" value={fmt(data.volume) + '株'} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 1株価チャート</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {RANGES.map(r => (
                      <button key={r} onClick={() => setRange(r)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: 'none', background: range === r ? 'rgba(196,156,72,0.15)' : 'transparent', color: range === r ? '#C49C48' : '#6B7280' }}>{RANGE_LABELS[r]}</button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={data.history} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C49C48" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#C49C48" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CastrokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: '#4B5563', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: '#4B5563', fontSize: 10 }} tickLine={false} axisLine={false} width={65} tickFormatter={v => '¥' + v.toLocaleString()} domain={['auto', 'auto']} />
                    <Tooltip content={<Tip />} />
                    <ReferenceLine y={data.high52} stroke="rgba(248,113,113,0.3)" strokeDasharray="3 3" />
                    <ReferenceLine y={data.low52} stroke="rgba(74,222,128,0.3)" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="value" stroke="#C49C48" strokeWidth={2} fill="url(#g2)" dot={false} activeDot={{ r: 4, fill: '#C49C48', strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.02)' borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: '#4ADE80' }}>安値 ¥{fmt(data.low52)}</span>
                    <span style={{ fontSize: 11, color: '#6B7280' }}>現在 ¥{fmt(data.price)}</span>
                    <span style={{ fontSize: 11, color: '#F87171' }}>高値 ¥{fmt(data.high52)}</span>
                  </div>
                  <div style={{ position: 'relative', height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: data.waterLevel + '%', background: 'linear-gradient(to right, #4ADE80, #C49C48, #F87171)', borderRadius: 3 }} />
                    <div style={{ position: 'absolute', top: -3, left: data.waterLevel + '%', transform: 'translateX(-50%)', width: 12, height: 12, borderRadius: '50%', background: '#E8E4D9', border: '2px solid #0D0F14' }} />
      iv>
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <WaterLevel pct={data.waterLevel} />
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12, letterSpacing: '1px', textTransform: 'uppercase' }}>財務情報</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
                <Card label="売上高" value={fmtB(data.sales)} />
                <Card label="営業利益" value={fmtB(data.op)} gold />
                <Card label="経常利益" value={fmtB(data.odp)} />
                <Card label="純利益" value={fmtB(            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <Card label="EPS" value={'¥' + (data.eps?.toFixed(1) ?? '-')} gold />
                <Card label="PER" value={data.per > 0 ? data.per + 'x' : '-'} sub="株価÷EPS" />
                <Card label="総資産" value={fmtB(data.ta)} />
                <Card label="純資産" value={fmtB(data.eq)} />
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
