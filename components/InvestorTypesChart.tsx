'use client'
import { useEffect, useState, useMemo } from 'react'
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Legend, ResponsiveContainer,
} from 'recharts'

const SECTIONS = ['TokyoNagoya', 'TSEPrime', 'TSEStandard', 'TSEGrowth'] as const
type Section = typeof SECTIONS[number]

const SECTION_LABELS: Record<Section, string> = {
  TokyoNagoya: '全体',
  TSEPrime:    'プライム',
  TSEStandard: 'スタンダード',
  TSEGrowth:   'グロース',
}

const INVESTORS = [
  { key: 'frgn',    label: '海外',    color: '#C49C48' },
  { key: 'ind',     label: '個人',    color: '#60A5FA' },
  { key: 'invTr',   label: '投信',    color: '#A78BFA' },
  { key: 'trstBnk', label: '信託銀行', color: '#34D399' },
  { key: 'busCo',   label: '事業法人', color: '#FB923C' },
  { key: 'insCo',   label: '生保損保', color: '#F472B6' },
] as const

type InvestorKey = typeof INVESTORS[number]['key']
type DisplayMode = 'Bal' | 'Buy' | 'Sell'

const MODE_LABELS: Record<DisplayMode, string> = {
  Bal:  '差引',
  Buy:  '買い',
  Sell: '売り',
}

const fmtY = (v: number) => {
  const abs = Math.abs(v)
  if (abs >= 1e12) return (v / 1e12).toFixed(1) + '兆'
  if (abs >= 1e8)  return (v / 1e8).toFixed(0) + '億'
  if (abs >= 1e6)  return (v / 1e6).toFixed(0) + '百万'
  return (v / 1e3).toFixed(0) + '千'
}

const fmtAmt = (v: number) => {
  const abs = Math.abs(v)
  const sign = v >= 0 ? '+' : '-'
  if (abs >= 1e8) return sign + (abs / 1e8).toFixed(0) + '億'
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(0) + '百万'
  return sign + (abs / 1e3).toFixed(0) + '千'
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'rgba(13,15,20,0.97)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 12, minWidth: 160 }}>
      <div style={{ color: '#6B7280', marginBottom: 8 }}>{label}</div>
      {payload
        .filter((p: any) => p.value !== 0 && p.value != null)
        .sort((a: any, b: any) => Math.abs(b.value) - Math.abs(a.value))
        .map((p: any) => (
          <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
            <span style={{ color: p.fill }}>{p.name}</span>
            <span style={{ color: p.value > 0 ? '#4ADE80' : '#F87171', fontWeight: 500 }}>
              {p.value > 0 ? '+' : ''}{fmtY(p.value)}
            </span>
          </div>
        ))}
    </div>
  )
}

const btn = (active: boolean, color?: string) => ({
  fontSize: 11,
  padding: '4px 10px',
  borderRadius: 6,
  cursor: 'pointer' as const,
  border: 'none',
  borderBottom: color ? `2px solid ${active ? color : 'transparent'}` : undefined,
  background: active ? 'rgba(196,156,72,0.15)' : 'transparent',
  color: active ? (color ?? '#C49C48') : '#6B7280',
})

const inputStyle = {
  background: 'rgba(255,255,255,0.05)',
  border: '0.5px solid rgba(255,255,255,0.1)',
  borderRadius: 6,
  padding: '5px 10px',
  fontSize: 12,
  color: '#E8E4D9',
  outline: 'none',
  cursor: 'pointer',
}

export default function InvestorTypesChart() {
  const [section,  setSection]  = useState<Section>('TokyoNagoya')
  const [investor, setInvestor] = useState<InvestorKey | 'all'>('all')
  const [mode,     setMode]     = useState<DisplayMode>('Bal')
  const [data,     setData]     = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)

  // 期間フィルタ（デフォルト：過去3ヶ月）
  const today = new Date()
  const threeMonthsAgo = new Date(today)
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const [fromDate, setFromDate] = useState(threeMonthsAgo.toISOString().split('T')[0])
  const [toDate,   setToDate]   = useState(today.toISOString().split('T')[0])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/market-sentiment?section=${section}`)
      .then(r => r.json())
      .then(json => {
        const rows = (json.data || []).map((r: any) => ({
          ...r,
          label: r.stDate?.slice(5) + '〜' + r.enDate?.slice(5),
        }))
        setData(rows)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [section])

  // 期間フィルタ適用
  const filteredData = useMemo(() => {
    return data.filter(r => {
      const d = r.stDate || r.pubDate
      return d >= fromDate && d <= toDate
    })
  }, [data, fromDate, toDate])

  // サマリー計算
  const summary = useMemo(() => {
    if (!filteredData.length) return null
    const totals: Record<string, number> = {}
    for (const inv of INVESTORS) {
      totals[`${inv.key}Buy`]  = filteredData.reduce((s, r) => s + (r[`${inv.key}Buy`]  ?? 0), 0)
      totals[`${inv.key}Sell`] = filteredData.reduce((s, r) => s + (r[`${inv.key}Sell`] ?? 0), 0)
      totals[`${inv.key}Bal`]  = filteredData.reduce((s, r) => s + (r[`${inv.key}Bal`]  ?? 0), 0)
    }
    const totalBuy  = INVESTORS.reduce((s, inv) => s + (totals[`${inv.key}Buy`]  ?? 0), 0)
    const totalSell = INVESTORS.reduce((s, inv) => s + (totals[`${inv.key}Sell`] ?? 0), 0)
    const totalBal  = INVESTORS.reduce((s, inv) => s + (totals[`${inv.key}Bal`]  ?? 0), 0)
    return { totals, totalBuy, totalSell, totalBal }
  }, [filteredData])

  const visibleInvestors = investor === 'all'
    ? INVESTORS
    : INVESTORS.filter(i => i.key === investor)

  const stackId = mode === 'Bal' ? 'a' : undefined

  const subtitle = mode === 'Bal'
    ? '週次集計・買い越し↑ / 売り越し↓'
    : mode === 'Buy' ? '週次買い金額'
    : '週次売り金額'

  return (
    <div>
      {/* サマリーパネル */}
      <div style={{ marginBottom: 16 }}>
        {/* 期間指定 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: '#6B7280' }}>期間</span>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={inputStyle} />
          <span style={{ fontSize: 11, color: '#4B5563' }}>〜</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={inputStyle} />
          <span style={{ fontSize: 11, color: '#4B5563' }}>{filteredData.length}週分</span>
        </div>

        {/* 合計BOX */}
        {summary && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
              {[
                { label: '買い計', value: summary.totalBuy,  color: '#4ADE80' },
                { label: '売り計', value: summary.totalSell, color: '#F87171' },
                { label: '差引',   value: summary.totalBal,  color: summary.totalBal >= 0 ? '#4ADE80' : '#F87171' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 4, letterSpacing: '0.05em' }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color }}>{fmtAmt(value)}</div>
                </div>
              ))}
            </div>

            {/* セグメント別 */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr 60px', gap: 4, marginBottom: 6 }}>
                {['', '買い', '売り', '差引', '比率(買い)'].map(h => (
                  <div key={h} style={{ fontSize: 10, color: '#4B5563', textAlign: h === '' ? 'left' : 'right' }}>{h}</div>
                ))}
              </div>
              {INVESTORS.map(inv => {
                const buy  = summary.totals[`${inv.key}Buy`]  ?? 0
                const sell = summary.totals[`${inv.key}Sell`] ?? 0
                const bal  = summary.totals[`${inv.key}Bal`]  ?? 0
                const ratio = summary.totalBuy > 0 ? (buy / summary.totalBuy * 100).toFixed(1) : '0.0'
                return (
                  <div key={inv.key} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr 60px', gap: 4, padding: '4px 0', borderTop: '0.5px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: 11, color: inv.color }}>{inv.label}</div>
                    <div style={{ fontSize: 11, color: '#4ADE80', textAlign: 'right' }}>{fmtAmt(buy)}</div>
                    <div style={{ fontSize: 11, color: '#F87171', textAlign: 'right' }}>{fmtAmt(sell)}</div>
                    <div style={{ fontSize: 11, color: bal >= 0 ? '#4ADE80' : '#F87171', textAlign: 'right' }}>{fmtAmt(bal)}</div>
                    <div style={{ fontSize: 11, color: '#B8B4A8', textAlign: 'right' }}>{ratio}%</div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* 1行目：タイトル + 市場フィルタ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 14, color: '#B8B4A8', fontWeight: 500 }}>投資部門別売買動向</div>
          <div style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>{subtitle}</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {SECTIONS.map(s => (
            <button key={s} onClick={() => setSection(s)} style={btn(section === s)}>
              {SECTION_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* 2行目：投資家フィルタ + 表示モード */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button onClick={() => setInvestor('all')} style={btn(investor === 'all')}>全投資家</button>
          {INVESTORS.map(inv => (
            <button key={inv.key} onClick={() => setInvestor(inv.key)} style={btn(investor === inv.key, inv.color)}>
              {inv.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(Object.keys(MODE_LABELS) as DisplayMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} style={btn(mode === m)}>{MODE_LABELS[m]}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4B5563', fontSize: 13 }}>Loading...</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={filteredData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }} stackOffset="sign">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#4B5563', fontSize: 9 }} tickLine={false} axisLine={false} interval={3} />
            <YAxis tick={{ fill: '#4B5563', fontSize: 10 }} tickLine={false} axisLine={false} width={55} tickFormatter={fmtY} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
            <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#6B7280', paddingTop: 8 }} />
            {visibleInvestors.map(({ key, label, color }) => (
              <Bar key={`${key}${mode}`} dataKey={`${key}${mode}`} name={label} stackId={stackId} fill={color} opacity={0.85} radius={0} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}