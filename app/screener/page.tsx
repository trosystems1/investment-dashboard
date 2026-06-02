'use client'
import { useEffect, useState, useMemo } from 'react'

type Stock = {
  code: string
  name: string
  sector: string
  price: number
  pbr: number | null
  per: number | null
  fper: number | null
  roe: number | null
  divYield: number | null
  marketCap: number | null
  opMargin: number | null
}

type SortKey = keyof Stock
type SortDir = 'asc' | 'desc'

const COLUMNS: { key: SortKey; label: string; format: (v: any) => string }[] = [
  { key: 'code',      label: 'コード',    format: v => v },
  { key: 'name',      label: '銘柄名',    format: v => v },
  { key: 'sector',    label: '業種',      format: v => v },
  { key: 'price',     label: '株価',      format: v => v?.toLocaleString() + '円' },
  { key: 'marketCap', label: '時価総額',  format: v => v ? v.toLocaleString() + '億' : '-' },
  { key: 'pbr',       label: 'PBR',       format: v => v ? v + '倍' : '-' },
  { key: 'per',       label: 'PER',       format: v => v ? v + '倍' : '-' },
  { key: 'fper',      label: '予想PER',   format: v => v ? v + '倍' : '-' },
  { key: 'roe',       label: 'ROE',       format: v => v ? v + '%' : '-' },
  { key: 'divYield',  label: '配当利回り', format: v => v ? v + '%' : '-' },
  { key: 'opMargin',  label: '営業利益率', format: v => v ? v + '%' : '-' },
]

export default function ScreenerPage() {
  const [data, setData]       = useState<Stock[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('marketCap')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filters, setFilters] = useState({
    pbrMax: '', roeMin: '', divMin: '', mcapMin: '',
  })

  useEffect(() => {
    fetch('/api/screener')
      .then(r => r.json())
      .then(json => { setData(json.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return data
      .filter(s => {
        if (search && !s.name.includes(search) && !s.code.includes(search)) return false
        if (filters.pbrMax && s.pbr && s.pbr > parseFloat(filters.pbrMax)) return false
        if (filters.roeMin && s.roe && s.roe < parseFloat(filters.roeMin)) return false
        if (filters.divMin && s.divYield && s.divYield < parseFloat(filters.divMin)) return false
        if (filters.mcapMin && s.marketCap && s.marketCap < parseFloat(filters.mcapMin)) return false
        return true
      })
      .sort((a, b) => {
        const av = a[sortKey] as any
        const bv = b[sortKey] as any
        if (av == null) return 1
        if (bv == null) return -1
        return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
      })
  }, [data, search, sortKey, sortDir, filters])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const cell = { padding: '8px 12px', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#B8B4A8', whiteSpace: 'nowrap' as const }
  const hcell = { ...cell, color: '#C49C48', cursor: 'pointer', userSelect: 'none' as const, fontWeight: 600 }
  const inpBase = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#B8B4A8', padding: '4px 8px', fontSize: 12 }
  const inp = { ...inpBase, width: 90 }

  return (
    <div className="p-4 md:p-6" style={{ minHeight: '100vh', background: '#0D0F14' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 className="text-xl md:text-[20px]" style={{ color: '#C49C48', fontWeight: 600, margin: 0 }}>
            プライム全銘柄スクリーナー
          </h1>
          <p style={{ fontSize: 12, color: '#4B5563', marginTop: 4 }}>
            {loading ? '読み込み中...' : `${filtered.length} / ${data.length} 銘柄`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-4">
          <input
            placeholder="銘柄名・コード検索"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full sm:w-40"
            style={inpBase}
          />
          <label style={{ fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 6 }}>
            PBR上限 <input placeholder="例: 1.5" value={filters.pbrMax} onChange={e => setFilters(f => ({ ...f, pbrMax: e.target.value }))} style={inp} />
          </label>
          <label style={{ fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 6 }}>
            ROE下限(%) <input placeholder="例: 8" value={filters.roeMin} onChange={e => setFilters(f => ({ ...f, roeMin: e.target.value }))} style={inp} />
          </label>
          <label style={{ fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 6 }}>
            配当利回り下限(%) <input placeholder="例: 2" value={filters.divMin} onChange={e => setFilters(f => ({ ...f, divMin: e.target.value }))} style={inp} />
          </label>
          <label style={{ fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 6 }}>
            時価総額下限(億) <input placeholder="例: 1000" value={filters.mcapMin} onChange={e => setFilters(f => ({ ...f, mcapMin: e.target.value }))} style={inp} />
          </label>
          <button
            onClick={() => setFilters({ pbrMax: '', roeMin: '', divMin: '', mcapMin: '' })}
            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: 'none', background: 'rgba(255,255,255,0.05)', color: '#6B7280' }}
          >
            リセット
          </button>
        </div>

        <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'rgba(255,255,255,0.02)' }}>
            <thead>
              <tr style={{ background: 'rgba(196,156,72,0.05)' }}>
                {COLUMNS.map(col => (
                  <th key={col.key} onClick={() => handleSort(col.key)} style={hcell}>
                    {col.label} {sortKey === col.key ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{ ...cell, textAlign: 'center', padding: 40, color: '#4B5563' }}>データ取得中...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} style={{ ...cell, textAlign: 'center', padding: 40, color: '#4B5563' }}>
                  データがありません。Cronジョブを実行してください。
                </td></tr>
              ) : (
                filtered.slice(0, 200).map(s => (
                  <tr key={s.code} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(196,156,72,0.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {COLUMNS.map(col => (
                      <td key={col.key} style={{
                        ...cell,
                        color: col.key === 'code' ? '#C49C48'
                          : col.key === 'roe' && s.roe && s.roe >= 8 ? '#4ADE80'
                          : col.key === 'pbr' && s.pbr && s.pbr < 1 ? '#4ADE80'
                          : col.key === 'divYield' && s.divYield && s.divYield >= 3 ? '#4ADE80'
                          : '#B8B4A8',
                      }}>
                        {col.format(s[col.key])}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 200 && (
          <p style={{ fontSize: 11, color: '#4B5563', marginTop: 8 }}>
            ※ 表示は上位200件まで。フィルタで絞り込んでください。
          </p>
        )}
      </div>
    </div>
  )
}
