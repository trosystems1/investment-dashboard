'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

type Stock = {
  code: string
  name: string
  sector: string
  market: string | null
  eps: number | null
  feps: number | null
  bps: number | null
  pbr: number | null
  per: number | null
  fper: number | null
  roe: number | null
  froe: number | null
  marketCap: number | null
}

type SortKey = keyof Stock
type SortDir = 'asc' | 'desc'

const MARKETS = ['すべて', 'プライム', 'スタンダード', 'グロース']

const COLUMNS: { key: SortKey; label: string; format: (v: any) => string; align: 'left' | 'right' }[] = [
  { key: 'code',      label: 'コード',   format: v => v, align: 'right' },
  { key: 'name',      label: '銘柄名',   format: v => v ?? '-', align: 'left' },
  { key: 'market',    label: '市場',     format: v => v ? String(v).replace('東証', '') : '-', align: 'left' },
  { key: 'sector',    label: '業種',     format: v => v ?? '-', align: 'left' },
  { key: 'marketCap', label: '時価総額', format: v => v ? v.toLocaleString() + '億' : '-', align: 'right' },
  { key: 'pbr',       label: 'PBR',      format: v => v ? v + '倍' : '-', align: 'right' },
  { key: 'per',       label: 'PER',      format: v => v ? v + '倍' : '-', align: 'right' },
  { key: 'fper',      label: '予想PER',  format: v => v ? v + '倍' : '-', align: 'right' },
  { key: 'roe',       label: 'ROE',      format: v => v != null ? v + '%' : '-', align: 'right' },
  { key: 'froe',      label: '予想ROE',  format: v => v != null ? v + '%' : '-', align: 'right' },
  { key: 'bps',       label: 'BPS',      format: v => v ? v.toLocaleString() + '円' : '-', align: 'right' },
]

export default function ScreenerPage() {
  const router = useRouter()
  const [data, setData]       = useState<Stock[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [market, setMarket]   = useState('すべて')
  const [sortKey, setSortKey] = useState<SortKey>('marketCap')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filters, setFilters] = useState({
    fperMax: '', froeMin: '', pbrMax: '', mcapMax: '',
  })
  const [page, setPage] = useState(1)
  const pageSize = 200

  useEffect(() => {
    fetch('/api/screener')
      .then(r => r.json())
      .then(json => { setData(json.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    setPage(1)
  }, [search, filters, market])

  const filtered = useMemo(() => {
    return data
      .filter(s => {
        if (search && !(s.name ?? '').includes(search) && !s.code.includes(search)) return false
        if (market !== 'すべて' && !(s.market ?? '').includes(market)) return false
        if (filters.fperMax && s.fper && s.fper > parseFloat(filters.fperMax)) return false
        if (filters.froeMin && s.froe != null && s.froe < parseFloat(filters.froeMin)) return false
        if (filters.pbrMax && s.pbr && s.pbr > parseFloat(filters.pbrMax)) return false
        if (filters.mcapMax && s.marketCap && s.marketCap > parseFloat(filters.mcapMax)) return false
        return true
      })
      .sort((a, b) => {
        const av = a[sortKey] as any
        const bv = b[sortKey] as any
        if (av == null) return 1
        if (bv == null) return -1
        return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
      })
  }, [data, search, sortKey, sortDir, filters, market])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const cell = { padding: '8px 12px', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#B8B4A8', whiteSpace: 'nowrap' as const }
  const hcell = { ...cell, color: '#C49C48', cursor: 'pointer', userSelect: 'none' as const, fontWeight: 600 }
  const inpBase = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#B8B4A8', padding: '4px 8px', fontSize: 12 }
  const inp = { ...inpBase, width: 90 }
  const lbl = { fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 6 }

  return (
    <div className="p-4 md:p-6" style={{ minHeight: '100vh', background: '#0D0F14' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 className="text-xl md:text-[20px]" style={{ color: '#C49C48', fontWeight: 600, margin: 0 }}>
            東証全銘柄スクリーナー
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
          <div style={{ display: 'flex', gap: 4 }}>
            {MARKETS.map(m => (
              <button
                key={m}
                onClick={() => setMarket(m)}
                style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: 'none',
                  background: market === m ? 'rgba(196,156,72,0.15)' : 'rgba(255,255,255,0.05)',
                  color: market === m ? '#C49C48' : '#6B7280',
                }}
              >
                {m}
              </button>
            ))}
          </div>
          <label style={lbl}>
            予想PER上限 <input placeholder="例: 15" value={filters.fperMax} onChange={e => setFilters(f => ({ ...f, fperMax: e.target.value }))} style={inp} />
          </label>
          <label style={lbl}>
            予想ROE下限(%) <input placeholder="例: 12" value={filters.froeMin} onChange={e => setFilters(f => ({ ...f, froeMin: e.target.value }))} style={inp} />
          </label>
          <label style={lbl}>
            PBR上限 <input placeholder="例: 1.5" value={filters.pbrMax} onChange={e => setFilters(f => ({ ...f, pbrMax: e.target.value }))} style={inp} />
          </label>
          <label style={lbl}>
            時価総額上限(億) <input placeholder="例: 300" value={filters.mcapMax} onChange={e => setFilters(f => ({ ...f, mcapMax: e.target.value }))} style={inp} />
          </label>
          <button
            onClick={() => { setFilters({ fperMax: '', froeMin: '', pbrMax: '', mcapMax: '' }); setMarket('すべて') }}
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
                  <th key={col.key} onClick={() => handleSort(col.key)} style={{ ...hcell, textAlign: col.align }}>
                    {col.label} {sortKey === col.key ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={COLUMNS.length} style={{ ...cell, textAlign: 'center', padding: 40, color: '#4B5563' }}>データ取得中...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={COLUMNS.length} style={{ ...cell, textAlign: 'center', padding: 40, color: '#4B5563' }}>
                  データがありません。Cronジョブを実行してください。
                </td></tr>
              ) : (
                paged.map(s => (
                  <tr key={s.code} style={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/stock/${s.code}.T`)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(196,156,72,0.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {COLUMNS.map(col => (
                      <td key={col.key} style={{
                        ...cell,
                        textAlign: col.align,
                        color: col.key === 'code' ? '#C49C48'
                          : col.key === 'froe' && s.froe != null && s.froe >= 12 ? '#4ADE80'
                          : col.key === 'roe' && s.roe != null && s.roe >= 8 ? '#4ADE80'
                          : col.key === 'fper' && s.fper && s.fper < 15 ? '#4ADE80'
                          : col.key === 'pbr' && s.pbr && s.pbr < 1 ? '#4ADE80'
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
        {filtered.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
            <p style={{ fontSize: 11, color: '#4B5563', margin: 0 }}>
              {(page - 1) * pageSize + 1}〜{Math.min(page * pageSize, filtered.length)}件目 / 全{filtered.length}件
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  fontSize: 11, padding: '4px 12px', borderRadius: 6, cursor: page <= 1 ? 'default' : 'pointer',
                  border: 'none', background: 'rgba(255,255,255,0.05)', color: page <= 1 ? '#374151' : '#B8B4A8',
                }}
              >
                前へ
              </button>
              <span style={{ fontSize: 11, color: '#6B7280', display: 'flex', alignItems: 'center' }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{
                  fontSize: 11, padding: '4px 12px', borderRadius: 6, cursor: page >= totalPages ? 'default' : 'pointer',
                  border: 'none', background: 'rgba(255,255,255,0.05)', color: page >= totalPages ? '#374151' : '#B8B4A8',
                }}
              >
                次へ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
