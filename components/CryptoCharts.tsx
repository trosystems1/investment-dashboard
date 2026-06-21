'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type PricePeriod = '24h' | '7d' | '30d' | '1y'

const PERIODS: { key: PricePeriod; label: string }[] = [
  { key: '24h', label: '24時間' },
  { key: '7d', label: '7日' },
  { key: '30d', label: '30日' },
  { key: '1y', label: '1年' },
]

type ChartPoint = {
  time: number
  label: string
  price: number
  volume?: number
  rsi?: number | null
  volSpike?: boolean
}

function formatPrice(productCode: string, price: number): string {
  if (productCode.endsWith('_JPY')) return `¥${Math.round(price).toLocaleString('ja-JP')}`
  return price.toLocaleString('ja-JP', { maximumFractionDigits: 8 })
}

const tabStyle = (active: boolean): CSSProperties => ({
  fontSize: 11,
  padding: '4px 10px',
  borderRadius: 6,
  cursor: 'pointer',
  border: 'none',
  letterSpacing: '0.3px',
  background: active ? 'rgba(129,140,248,0.2)' : 'transparent',
  color: active ? '#818CF8' : '#6B7280',
})

export default function CryptoCharts({ productCode }: { productCode: string }) {
  const [period, setPeriod] = useState<PricePeriod>('24h')
  const [data, setData] = useState<ChartPoint[]>([])
  const [source, setSource] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(
      `/api/crypto/price-history?product_code=${encodeURIComponent(productCode)}&period=${period}`,
    )
      .then(async (r) => {
        const json = await r.json()
        if (!r.ok) {
          setError(json.error ?? `HTTP ${r.status}`)
          setData([])
          return
        }
        const raw = (json.points ?? []) as Array<{
          time: number
          label?: string
          price: number
          volume?: number
          rsi?: number | null
        }>
        if (raw.length === 0) {
          setData([])
          setSource(json.source ?? '')
          return
        }
        setSource(json.source ?? '')
        const avgVol =
          period === '24h' && raw.some((p) => p.volume != null)
            ? raw.reduce((s, c) => s + (c.volume ?? 0), 0) / raw.length
            : 0
        setData(
          raw.map((c) => ({
            time: c.time,
            label: c.label ?? String(c.time),
            price: c.price,
            volume: c.volume,
            rsi: c.rsi,
            volSpike: avgVol > 0 && (c.volume ?? 0) >= avgVol * 3,
          })),
        )
      })
      .catch(() => {
        setError('チャートデータの取得に失敗しました')
        setData([])
      })
      .finally(() => setLoading(false))
  }, [productCode, period])

  const rsiData = useMemo(() => data.filter((d) => d.rsi != null), [data])
  const isShortTerm = period === '24h'

  const pctChange = useMemo(() => {
    if (data.length < 2) return null
    const first = data[0].price
    const last = data[data.length - 1].price
    if (!first) return null
    return (((last - first) / first) * 100).toFixed(2)
  }, [data])

  return (
    <div style={{ marginBottom: 20, width: '100%', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            価格{isShortTerm ? '・出来高' : ''}
          </span>
          {pctChange != null && (
            <span
              style={{
                fontSize: 11,
                color: parseFloat(pctChange) >= 0 ? '#4ADE80' : '#F87171',
              }}
            >
              {parseFloat(pctChange) >= 0 ? '+' : ''}
              {pctChange}%
            </span>
          )}
          {source && (
            <span style={{ fontSize: 10, color: '#4B5563' }}>
              ({source === 'bitflyer' ? '5分足' : 'CoinGecko'})
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {PERIODS.map((p) => (
            <button key={p.key} type="button" style={tabStyle(period === p.key)} onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 13 }}>
          チャート読み込み中...
        </div>
      ) : error ? (
        <p style={{ fontSize: 12, color: '#F87171', margin: 0 }}>{error}</p>
      ) : data.length === 0 ? (
        <p style={{ fontSize: 12, color: '#4B5563', margin: 0 }}>
          {period === '24h'
            ? '5分足データがまだありません。Cron実行後に表示されます。'
            : 'データ取得に失敗しました。しばらくして再読み込みしてください。'}
        </p>
      ) : isShortTerm ? (
        <>
          <div style={{ width: '100%', height: 200, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`cryptoPrice-${productCode}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818CF8" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#818CF8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#4B5563', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis
                  yAxisId="price"
                  tick={{ fill: '#4B5563', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                  tickFormatter={(v) => (productCode.endsWith('_JPY') ? `${(v / 1e6).toFixed(1)}M` : String(v))}
                  domain={['auto', 'auto']}
                />
                <YAxis yAxisId="volume" orientation="right" hide domain={[0, 'auto']} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as ChartPoint
                    return (
                      <div style={{ background: 'rgba(13,15,20,0.97)', border: '0.5px solid rgba(129,140,248,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
                        <div style={{ color: '#6B7280', marginBottom: 4 }}>{d.label}</div>
                        <div style={{ color: '#818CF8', fontWeight: 600 }}>{formatPrice(productCode, d.price)}</div>
                        {d.volume != null && <div style={{ color: '#9CA3AF', marginTop: 4 }}>出来高 {d.volume.toFixed(4)}</div>}
                      </div>
                    )
                  }}
                />
                <Area yAxisId="price" type="monotone" dataKey="price" stroke="#818CF8" strokeWidth={2} fill={`url(#cryptoPrice-${productCode})`} dot={false} />
                <Bar yAxisId="volume" dataKey="volume" barSize={4} radius={[1, 1, 0, 0]}>
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.volSpike ? 'rgba(251,146,60,0.85)' : 'rgba(129,140,248,0.35)'} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <p style={{ fontSize: 11, color: '#6B7280', letterSpacing: '0.08em', margin: '16px 0 8px', textTransform: 'uppercase' }}>
            RSI(14)
          </p>
          {rsiData.length === 0 ? (
            <p style={{ fontSize: 12, color: '#4B5563', margin: 0 }}>RSI計算に必要な足数が不足しています。</p>
          ) : (
            <div style={{ width: '100%', height: 140, minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rsiData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#4B5563', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis domain={[0, 100]} tick={{ fill: '#4B5563', fontSize: 10 }} tickLine={false} axisLine={false} width={32} />
                  <ReferenceArea y1={0} y2={30} fill="rgba(251,146,60,0.08)" />
                  <ReferenceLine y={30} stroke="rgba(251,146,60,0.5)" strokeDasharray="4 4" />
                  <ReferenceLine y={70} stroke="rgba(248,113,113,0.4)" strokeDasharray="4 4" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload as ChartPoint
                      return (
                        <div style={{ background: 'rgba(13,15,20,0.97)', border: '0.5px solid rgba(129,140,248,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
                          <div style={{ color: '#818CF8' }}>RSI {d.rsi}</div>
                        </div>
                      )
                    }}
                  />
                  <Line type="monotone" dataKey="rsi" stroke="#818CF8" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      ) : (
        <div style={{ width: '100%', height: 220, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChartSimple data={data} productCode={productCode} />
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function AreaChartSimple({ data, productCode }: { data: ChartPoint[]; productCode: string }) {
  return (
    <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
      <defs>
        <linearGradient id={`cryptoLong-${productCode}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#818CF8" stopOpacity={0.25} />
          <stop offset="95%" stopColor="#818CF8" stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
      <XAxis dataKey="label" tick={{ fill: '#4B5563', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
      <YAxis
        tick={{ fill: '#4B5563', fontSize: 10 }}
        tickLine={false}
        axisLine={false}
        width={72}
        tickFormatter={(v) => (productCode.endsWith('_JPY') ? `${(v / 1e6).toFixed(1)}M` : String(v))}
        domain={['auto', 'auto']}
      />
      <Tooltip
        content={({ active, payload }) => {
          if (!active || !payload?.length) return null
          const d = payload[0].payload as ChartPoint
          return (
            <div style={{ background: 'rgba(13,15,20,0.97)', border: '0.5px solid rgba(129,140,248,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
              <div style={{ color: '#6B7280', marginBottom: 4 }}>{d.label}</div>
              <div style={{ color: '#818CF8', fontWeight: 600 }}>{formatPrice(productCode, d.price)}</div>
            </div>
          )
        }}
      />
      <Area type="monotone" dataKey="price" stroke="#818CF8" strokeWidth={2} fill={`url(#cryptoLong-${productCode})`} dot={false} />
    </ComposedChart>
  )
}
