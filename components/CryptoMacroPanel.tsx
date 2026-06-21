'use client'

import { useEffect, useState } from 'react'
import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type MacroPoint = { timestamp: string; value: number }

type FearGreedPoint = { value: number; classification: string; timestamp: number }

type DxyBtcPoint = { date: string; time: number; btc: number; dxy: number }

type MacroResponse = {
  btcDominance: MacroPoint[]
  stablecoinSupply: MacroPoint[]
  latestDominance: MacroPoint | null
  latestStablecoin: MacroPoint | null
  fearGreed: FearGreedPoint[]
  currentFng: FearGreedPoint | null
  dxyBtc: DxyBtcPoint[]
  errors?: string[]
}

function fngColor(value: number): string {
  if (value < 25) return '#F87171'
  if (value < 45) return '#FB923C'
  if (value < 55) return '#9CA3AF'
  if (value < 75) return '#4ADE80'
  return '#22C55E'
}

function formatMacroTime(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
  })
}

function formatUsd(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  return `$${n.toLocaleString('en-US')}`
}

const panelStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.02)',
  border: '0.5px solid rgba(255,255,255,0.06)',
  borderRadius: 10,
  padding: 16,
}

export default function CryptoMacroPanel() {
  const [data, setData] = useState<MacroResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/crypto/macro')
      .then(async (r) => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error ?? 'fetch failed')
        setData(json)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'データ取得失敗'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ color: '#6B7280', fontSize: 13, padding: 16, textAlign: 'center' }}>マクロ指標読み込み中...</div>
  }

  if (error || !data) {
    return <p style={{ fontSize: 12, color: '#F87171' }}>{error ?? 'マクロデータを取得できませんでした'}</p>
  }

  const dominanceChart = data.btcDominance.slice(-168).map((p) => ({
    label: formatMacroTime(p.timestamp),
    value: p.value,
  }))

  const stableChart = data.stablecoinSupply.slice(-168).map((p) => ({
    label: formatMacroTime(p.timestamp),
    value: p.value / 1e9,
  }))

  const fngChart = data.fearGreed.map((p) => ({
    label: new Date(p.timestamp * 1000).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
    value: p.value,
  }))

  const currentFng = data.currentFng?.value ?? 50

  return (
    <div>
      <h4 style={{ fontSize: 13, color: '#B8B4A8', fontWeight: 500, margin: '0 0 4px' }}>マクロ・資金フロー</h4>
      <p style={{ fontSize: 11, color: '#4B5563', margin: '0 0 16px' }}>世界の資金が仮想通貨市場に向かっているかの参考指標</p>

      {data.errors && data.errors.length > 0 && (
        <p style={{ fontSize: 11, color: '#FB923C', marginBottom: 12 }}>
          一部データ取得失敗: {data.errors.join(', ')}
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {/* BTC Dominance */}
        <div style={panelStyle}>
          <div style={{ fontSize: 12, color: '#E8E4D9', fontWeight: 500, marginBottom: 4 }}>
            BTCドミナンス
            {data.latestDominance && (
              <span style={{ color: '#818CF8', marginLeft: 8 }}>{data.latestDominance.value}%</span>
            )}
          </div>
          <p style={{ fontSize: 10, color: '#6B7280', margin: '0 0 10px', lineHeight: 1.5 }}>
            上昇＝資金がBTCに集中／下降＝アルトコインへ分散
          </p>
          {dominanceChart.length === 0 ? (
            <p style={{ fontSize: 11, color: '#4B5563' }}>Cron未実行（/api/cron/crypto-macro を1時間おきに設定）</p>
          ) : (
            <Chart height={120} data={dominanceChart} dataKey="value" color="#818CF8" unit="%" />
          )}
        </div>

        {/* Stablecoin supply */}
        <div style={panelStyle}>
          <div style={{ fontSize: 12, color: '#E8E4D9', fontWeight: 500, marginBottom: 4 }}>
            ステーブルコイン供給量
            {data.latestStablecoin && (
              <span style={{ color: '#4ADE80', marginLeft: 8 }}>{formatUsd(data.latestStablecoin.value)}</span>
            )}
          </div>
          <p style={{ fontSize: 10, color: '#6B7280', margin: '0 0 10px', lineHeight: 1.5 }}>
            増加トレンド＝新規資金が暗号資産市場へ流入している可能性
          </p>
          {stableChart.length === 0 ? (
            <p style={{ fontSize: 11, color: '#4B5563' }}>Cron未実行</p>
          ) : (
            <Chart height={120} data={stableChart} dataKey="value" color="#4ADE80" unit="B USD" />
          )}
        </div>

        {/* Fear & Greed */}
        <div style={panelStyle}>
          <div style={{ fontSize: 12, color: '#E8E4D9', fontWeight: 500, marginBottom: 8 }}>
            Fear &amp; Greed指数
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6B7280', marginBottom: 4 }}>
              <span>Extreme Fear</span>
              <span>Extreme Greed</span>
            </div>
            <div style={{ height: 10, borderRadius: 5, background: 'linear-gradient(to right, #F87171, #FB923C, #9CA3AF, #4ADE80, #22C55E)' }} />
            <div
              style={{
                marginTop: -16,
                marginLeft: `${currentFng}%`,
                transform: 'translateX(-50%)',
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: fngColor(currentFng),
                border: '2px solid #0D0F14',
              }}
            />
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 600, color: fngColor(currentFng) }}>{currentFng}</span>
              <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 8 }}>{data.currentFng?.classification}</span>
            </div>
          </div>
          {fngChart.length > 0 && (
            <Chart height={100} data={fngChart} dataKey="value" color="#C49C48" domain={[0, 100]} />
          )}
        </div>

        {/* DXY vs BTC */}
        <div style={{ ...panelStyle, gridColumn: '1 / -1' }}>
          <div style={{ fontSize: 12, color: '#E8E4D9', fontWeight: 500, marginBottom: 4 }}>BTC/JPY vs ドル指数（DXY）</div>
          <p style={{ fontSize: 10, color: '#6B7280', margin: '0 0 10px', lineHeight: 1.5 }}>
            ドル高・BTC安など、マクロ環境とBTCの動きを視覚的に比較（日次・1年）
          </p>
          {data.dxyBtc.length === 0 ? (
            <p style={{ fontSize: 11, color: '#4B5563' }}>DXY/BTCデータを取得できませんでした</p>
          ) : (
            <div style={{ width: '100%', height: 200, minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.dxyBtc} margin={{ top: 5, right: 48, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#4B5563', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis yAxisId="btc" tick={{ fill: '#818CF8', fontSize: 10 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                  <YAxis yAxisId="dxy" orientation="right" tick={{ fill: '#C49C48', fontSize: 10 }} tickLine={false} axisLine={false} width={40} domain={['auto', 'auto']} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload as DxyBtcPoint
                      return (
                        <div style={{ background: 'rgba(13,15,20,0.97)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
                          <div style={{ color: '#6B7280', marginBottom: 4 }}>{d.date}</div>
                          <div style={{ color: '#818CF8' }}>BTC ¥{d.btc.toLocaleString('ja-JP')}</div>
                          <div style={{ color: '#C49C48' }}>DXY {d.dxy}</div>
                        </div>
                      )
                    }}
                  />
                  <Line yAxisId="btc" type="monotone" dataKey="btc" stroke="#818CF8" strokeWidth={2} dot={false} name="BTC/JPY" />
                  <Line yAxisId="dxy" type="monotone" dataKey="dxy" stroke="#C49C48" strokeWidth={2} dot={false} name="DXY" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Chart({
  data,
  dataKey,
  color,
  height,
  domain,
  unit,
}: {
  data: { label: string; value: number }[]
  dataKey: string
  color: string
  height: number
  domain?: [number, number]
  unit?: string
}) {
  return (
    <div style={{ width: '100%', height, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#4B5563', fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis domain={domain ?? ['auto', 'auto']} tick={{ fill: '#4B5563', fontSize: 9 }} tickLine={false} axisLine={false} width={36} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const v = payload[0].value as number
              return (
                <div style={{ background: 'rgba(13,15,20,0.97)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
                  {unit ? `${v} ${unit}` : v}
                </div>
              )
            }}
          />
          <Area type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.12} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
