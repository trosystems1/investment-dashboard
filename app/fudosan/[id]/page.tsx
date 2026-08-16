import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLatestProperty } from '@/lib/fudosan/store'

export const revalidate = 60

const VERDICT: Record<string, { bg: string; color: string; border: string }> = {
  A: { bg: 'rgba(74,222,128,0.12)', color: '#4ADE80', border: 'rgba(74,222,128,0.35)' },
  B: { bg: 'rgba(56,189,248,0.12)', color: '#38BDF8', border: 'rgba(56,189,248,0.35)' },
  C: { bg: 'rgba(251,191,36,0.12)', color: '#FBBF24', border: 'rgba(251,191,36,0.35)' },
  NG: { bg: 'rgba(248,113,113,0.12)', color: '#F87171', border: 'rgba(248,113,113,0.35)' },
  PENDING: { bg: 'rgba(255,255,255,0.06)', color: '#9CA3AF', border: 'rgba(255,255,255,0.12)' },
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 11, color: '#6B7280', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, color: '#B8B4A8', fontSize: 13, lineHeight: 1.7 }}>
        {items.map((x, i) => <li key={i}>{x}</li>)}
      </ul>
    </div>
  )
}

export default async function FudosanDetailPage({ params }: { params: { id: string } }) {
  const row = await getLatestProperty(params.id)
  if (!row) notFound()

  const m = row.metrics ?? {}
  const style = VERDICT[row.verdict ?? 'PENDING'] ?? VERDICT.PENDING
  const metricPairs: Array<[string, string]> = [
    ['表面利回り', num(m.gross_yield) != null ? `${m.gross_yield}%` : '—'],
    ['実質利回り', num(m.real_yield) != null ? `${m.real_yield}%` : '—'],
    ['NOI', num(m.noi) != null ? `${m.noi}万` : '—'],
    ['BTCF', num(m.btcf) != null ? `${m.btcf}万/年` : '—'],
    ['自己資本増加', num(m.equity_gain) != null ? `${m.equity_gain}万（${m.equity_rate}%）` : '—'],
    ['㎡単価 vs 相場', num(m.price_vs_market) != null ? `${m.price_vs_market}%` : '—'],
    ['必要家賃', num(m.rent_required_man) != null ? `${m.rent_required_man}万/月` : '—'],
  ]

  return (
    <div className="p-4 md:p-6" style={{ minHeight: '100vh', background: '#0D0F14', color: '#E8E4D9' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <Link href="/fudosan" style={{ fontSize: 12, color: '#6B7280', textDecoration: 'none' }}>← 一覧</Link>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginTop: 16 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{row.name ?? '（名称不明）'}</h2>
            <p style={{ fontSize: 13, color: '#9CA3AF', margin: '6px 0 0' }}>
              {[row.address ?? row.city, row.station ? `${row.line ?? ''} ${row.station}${row.walk_min ? ` 徒歩${row.walk_min}分` : ''}` : '', row.built_ym].filter(Boolean).join(' · ')}
            </p>
          </div>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            borderRadius: 999,
            padding: '4px 12px',
            fontSize: 13,
            fontWeight: 600,
            background: style.bg,
            color: style.color,
            border: `0.5px solid ${style.border}`,
            whiteSpace: 'nowrap',
          }}>
            {row.verdict ?? '—'} {row.score ?? ''}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 20 }}>
          {[
            ['価格', row.price_man != null ? `${row.price_man.toLocaleString()}万` : '—'],
            ['面積', row.area_sqm != null ? `${row.area_sqm}㎡` : '—'],
            ['賃料', row.rent_man != null ? `${row.rent_man}万` : '—'],
          ].map(([k, v]) => (
            <div key={k} style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: '#6B7280' }}>{k}</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20, marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
            {metricPairs.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#6B7280' }}>{k}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</span>
              </div>
            ))}
          </div>

          {typeof m.market_note === 'string' && (
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '14px 0 0', lineHeight: 1.6 }}>{m.market_note}</p>
          )}
          {row.rent_man == null && typeof m.rent_required_driver === 'string' && (
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '6px 0 0', lineHeight: 1.6 }}>
              賃料不明。基準クリアには月額 {String(m.rent_required_man)}万円以上が必要（律速: {m.rent_required_driver}）
            </p>
          )}

          <Section title="ハードNG" items={row.ng_reasons ?? []} />
          <Section title="減点" items={(row.warnings ?? []).map(w => w.tag)} />
          <Section title="要確認" items={row.todo ?? []} />

          {row.drive_link && (
            <div style={{ marginTop: 20 }}>
              <a href={row.drive_link} target="_blank" rel="noreferrer" style={{ color: '#C49C48', fontSize: 13 }}>
                マイソクを開く →
              </a>
            </div>
          )}
          {row.criteria_version && (
            <p style={{ fontSize: 11, color: '#4B5563', margin: '16px 0 0' }}>
              {row.criteria_version}{row.evaluated_at ? ` · ${new Date(row.evaluated_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}` : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
