import Link from 'next/link'
import { listLatestProperties } from '@/lib/fudosan/store'

export const revalidate = 60

const VERDICT: Record<string, { bg: string; color: string; border: string }> = {
  A: { bg: 'rgba(74,222,128,0.12)', color: '#4ADE80', border: 'rgba(74,222,128,0.35)' },
  B: { bg: 'rgba(56,189,248,0.12)', color: '#38BDF8', border: 'rgba(56,189,248,0.35)' },
  C: { bg: 'rgba(251,191,36,0.12)', color: '#FBBF24', border: 'rgba(251,191,36,0.35)' },
  NG: { bg: 'rgba(248,113,113,0.12)', color: '#F87171', border: 'rgba(248,113,113,0.35)' },
  PENDING: { bg: 'rgba(255,255,255,0.06)', color: '#9CA3AF', border: 'rgba(255,255,255,0.12)' },
}

/** 調査日（＝マイソクを取り込んで診断した日）。日本時間の日付で出す */
function jstDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' })
}

/** 何日前か。物件は数週間で売れて消えるので、古い行はひと目で分かるようにする */
function daysAgo(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 86_400_000)) : null
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** 建物の賃貸募集率のセル。criteria.ts の閾値（6/10/15%）に合わせて色を付ける */
function vacancyCell(m: Record<string, unknown>): { main: string; sub: string; color: string } {
  const rate = num(m.vacancy_rate)
  const n = num(m.vacancy_listings)
  if (rate != null && m.vacancy_suspect === true) {
    return { main: `${rate}%?`, sub: '重複の疑い', color: '#6B7280' }
  }
  if (rate != null) {
    const color = rate >= 15 ? '#F87171' : rate >= 10 ? '#FB923C' : rate >= 6 ? '#FBBF24' : '#E8E4D9'
    return { main: `${rate}%`, sub: `${n ?? '—'}/${m.vacancy_units ?? '—'}戸`, color }
  }
  if (n != null) return { main: `${n}室`, sub: '総戸数不明', color: '#E8E4D9' }
  if (typeof m.vacancy_note === 'string' && m.vacancy_note.includes('確認できず')) {
    return { main: '取得失敗', sub: '', color: '#4B5563' }
  }
  return { main: '—', sub: '', color: '#4B5563' }
}

export default async function FudosanPage() {
  const { rows, configured } = await listLatestProperties()
  const count = (v: string) => rows.filter(r => r.verdict === v).length
  const version = rows.find(r => r.criteria_version)?.criteria_version?.split('-')[0] ?? ''
  const now = Date.now()
  const lastSurvey = rows.reduce<string | null>((m, r) => (!m || r.created_at > m ? r.created_at : m), null)
  const lastJudge = rows.reduce<string | null>((m, r) => (r.evaluated_at && (!m || r.evaluated_at > m) ? r.evaluated_at : m), null)

  return (
    <div className="p-4 md:p-6" style={{ minHeight: '100vh', background: '#0D0F14', color: '#E8E4D9' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>不動産</h2>
            <Link href="/fudosan/areas" style={{ fontSize: 13, color: '#C49C48', textDecoration: 'none' }}>エリア分析 →</Link>
          </div>
          <p style={{ fontSize: 11, color: '#6B7280', margin: '4px 0 0', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            Jonan Condo · Criteria {version || '—'}
          </p>
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: '6px 0 0' }}>
            最終調査 {jstDate(lastSurvey)} · 最終判定 {jstDate(lastJudge)}
          </p>
          <div style={{ width: 32, height: 2, background: 'linear-gradient(to right, #C49C48, transparent)', borderRadius: 1, marginTop: 8 }} />
        </div>

        {!configured && (
          <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 20 }}>
            Supabase が未設定です。`scripts/fudosan.sql` と `scripts/fudosan-districts.sql` を実行し、`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` を入れてください。
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-5" style={{ gap: 8, marginBottom: 20 }}>
          {[
            ['流入', rows.length, '#E8E4D9'],
            ['◎ A', count('A'), '#4ADE80'],
            ['○ B', count('B'), '#38BDF8'],
            ['△ C', count('C'), '#FBBF24'],
            ['× NG', count('NG'), '#F87171'],
          ].map(([k, v, color]) => (
            <div key={String(k)} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '0.5px solid rgba(255,255,255,0.07)',
              borderRadius: 12,
              padding: '12px 16px',
            }}>
              <div style={{ fontSize: 11, color: '#6B7280' }}>{k}</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: String(color), fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: '#6B7280', fontSize: 11 }}>
                {['判定', '物件', '価格', '面積', '表面', 'BTCF', '自己資本増', '空室', '調査日', '主な理由'].map((h, i) => (
                  <th key={h} style={{
                    padding: '10px 12px',
                    textAlign: i === 0 || i === 1 || i === 9 ? 'left' : 'right',
                    fontWeight: 500,
                    borderBottom: '0.5px solid rgba(255,255,255,0.07)',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const m = r.metrics ?? {}
                // NGだけでなく、収益性・資産形成・出口のどのゲートで落ちたかも出す。
                // 理由が見えないと、なぜCなのかが画面から分からない。
                const reason =
                  (r.ng_reasons ?? [])[0] ??
                  (r.gate2_fails ?? [])[0] ??
                  (r.gate3_fails ?? [])[0] ??
                  (r.gate4_fails ?? [])[0] ??
                  (r.warnings ?? [])[0]?.tag ??
                  ''
                const style = VERDICT[r.verdict ?? 'PENDING'] ?? VERDICT.PENDING
                const btcf = num(m.btcf)
                const vac = vacancyCell(m)
                const age = daysAgo(r.created_at, now)
                return (
                  <tr key={r.id}>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        borderRadius: 999,
                        padding: '2px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                        background: style.bg,
                        color: style.color,
                        border: `0.5px solid ${style.border}`,
                      }}>
                        {r.verdict ?? '—'} {r.score ?? ''}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                      <Link href={`/fudosan/${r.id}`} style={{ color: '#E8E4D9', textDecoration: 'none', fontWeight: 500 }}>
                        {r.name ?? '（名称不明）'}
                      </Link>
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                        {r.city ?? ''} {r.station ? `${r.station}${r.walk_min ? ` 徒歩${r.walk_min}分` : ''}` : ''} {r.built_ym ?? ''}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                      {r.price_man?.toLocaleString() ?? '—'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                      {r.area_sqm ?? '—'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                      {num(m.gross_yield) != null ? `${m.gross_yield}%` : '—'}
                    </td>
                    <td style={{
                      padding: '10px 12px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      color: (btcf ?? 0) < 0 ? '#F87171' : undefined,
                      borderBottom: '0.5px solid rgba(255,255,255,0.05)',
                    }}>
                      {btcf ?? '—'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                      {num(m.equity_gain) != null ? `${m.equity_gain}（${m.equity_rate}%）` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ color: vac.color }}>{vac.main}</span>
                      {vac.sub && <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{vac.sub}</div>}
                    </td>
                    <td
                      title={r.evaluated_at ? `最終判定 ${new Date(r.evaluated_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}` : undefined}
                      style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ color: age != null && age > 30 ? '#6B7280' : '#E8E4D9' }}>{jstDate(r.created_at)}</span>
                      {age != null && <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{age === 0 ? '今日' : `${age}日前`}</div>}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: '#6B7280', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                      {reason}
                    </td>
                  </tr>
                )
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={10} style={{ padding: '40px 12px', textAlign: 'center', color: '#4B5563' }}>
                    まだ物件がありません。Driveの受信箱フォルダにマイソクを置いてください。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
