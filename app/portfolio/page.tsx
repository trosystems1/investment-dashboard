'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import KpiCard from '@/components/KpiCard'
import SaxoPositions from '@/components/SaxoPositions'
import { formatJPYCompound, formatJPYCompoundSigned } from '@/lib/format'

export default function PortfolioPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [saxoStatus, setSaxoStatus] = useState<'connected' | 'disconnected' | 'loading'>('loading')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    fetch('/api/saxo/balance')
      .then(r => r.json())
      .then(j => setSaxoStatus(j.error ? 'disconnected' : 'connected'))
      .catch(() => setSaxoStatus('disconnected'))
  }, [])

  if (status === 'loading') return null

  return (
    <div className="p-4 md:p-6" style={{ minHeight: '100vh', background: '#0D0F14', fontFamily: 'var(--font-body)', color: '#E8E4D9' }}>
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto' }}>

        {/* ページタイトル */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#E8E4D9', margin: 0, letterSpacing: '-0.3px' }}>Portfolio</h2>
          <p style={{ fontSize: 11, color: '#6B7280', margin: '4px 0 0', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Personal Asset Overview</p>
          <div style={{ width: 32, height: 2, background: 'linear-gradient(to right, #C49C48, transparent)', borderRadius: 1, marginTop: 8 }} />
        </div>

        {/* KPI（ダミー） */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiCard label="Total Value"    value={formatJPYCompound(142_800_000)} badge="2.34% 前日比" badgeUp isGold />
          <KpiCard label="Day P&L"        value={formatJPYCompoundSigned(3_260_000)} badge="本日損益"     badgeUp />
          <KpiCard label="Unrealized P&L" value="---"     badge="含み損益"     badgeUp />
          <KpiCard label="Sharpe Ratio"   value="2.41"    badge="リスク調整済" badgeUp />
        </div>

        {/* Saxo未接続バナー */}
        {saxoStatus === 'disconnected' && (
          <a href="/saxo-connect" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(196,156,72,0.06)', border: '0.5px solid rgba(196,156,72,0.2)',
            borderRadius: 10, padding: '12px 20px', marginBottom: 24, textDecoration: 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 13, color: '#C49C48', fontWeight: 500 }}>サクソバンク未接続</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>SAXO 残高・ポジション情報を表示するには接続が必要です</div>
              </div>
            </div>
            <span style={{ fontSize: 12, color: '#C49C48', border: '0.5px solid rgba(196,156,72,0.3)', padding: '6px 14px', borderRadius: 20 }}>接続する →</span>
          </a>
        )}

        {/* Saxoポジション */}
        <SaxoPositions />

      </div>
    </div>
  )
}