'use client'

import { useState, useEffect } from 'react'
import InvestorTypesChart from '@/components/InvestorTypesChart'
import TopixChart from '@/components/TopixChart'
import NenkinRanking from '@/components/NenkinRanking'
import CryptoDashboard from '@/components/CryptoDashboard'

interface SignalRun {
  timestamp: string
  signalCount: number
  signals: string[]
  tickerCount: number
}

export default function Dashboard() {
  const [signalRun, setSignalRun] = useState<SignalRun | null>(null)

  useEffect(() => {
    fetch('/api/settings/signal')
      .then((r) => r.json())
      .then((j) => setSignalRun(j.lastRun))
      .catch(() => {})
  }, [])

  return (
    <div className="p-4 md:p-6" style={{ minHeight: '100vh', background: '#0D0F14', fontFamily: 'var(--font-body)', color: '#E8E4D9' }}>
      <div style={{ position: 'fixed', top: -200, right: -200, width: 500, height: 500, background: 'radial-gradient(circle, rgba(196,156,72,0.06) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: -100, left: -100, width: 400, height: 400, background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto' }}>

        <div className="mb-6">
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#E8E4D9', margin: 0, letterSpacing: '-0.3px' }}>Market</h2>
          <p style={{ fontSize: 11, color: '#6B7280', margin: '4px 0 0', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Market Overview & Crypto</p>
          <div style={{ width: 32, height: 2, background: 'linear-gradient(to right, #C49C48, transparent)', borderRadius: 1, marginTop: 8 }} />
        </div>

        {signalRun && (
          <a href="/settings" style={{
            display: 'block',
            background: signalRun.signalCount > 0 ? 'rgba(196,156,72,0.06)' : 'rgba(255,255,255,0.02)',
            border: `0.5px solid ${signalRun.signalCount > 0 ? 'rgba(196,156,72,0.25)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 10,
            padding: signalRun.signalCount > 0 ? '14px 20px' : '12px 20px',
            marginBottom: 16,
            textDecoration: 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: signalRun.signalCount > 0 ? 8 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15 }}>{signalRun.signalCount > 0 ? '🔔' : '✓'}</span>
                <span style={{ fontSize: 15, color: signalRun.signalCount > 0 ? '#C49C48' : '#6B7280', fontWeight: 500 }}>
                  {signalRun.signalCount > 0 ? `シグナル検出 ${signalRun.signalCount}件` : 'シグナルなし'}
                </span>
                <span style={{ fontSize: 11, color: '#6B7280' }}>
                  {new Date(signalRun.timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {signalRun.tickerCount ? `　${signalRun.tickerCount}銘柄チェック` : ''}
                  　/　次回: 平日 朝9:00
                </span>
              </div>
              <span style={{ fontSize: 11, color: '#6B7280' }}>詳細 →</span>
            </div>
            {signalRun.signalCount > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {signalRun.signals.map((s, i) => (
                  <div key={i} style={{ fontSize: 14, color: '#B8B4A8', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {s}
                  </div>
                ))}
              </div>
            )}
          </a>
        )}

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <InvestorTypesChart />
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <TopixChart />
        </div>

        <div style={{ marginBottom: 16 }}>
          <NenkinRanking />
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(129,140,248,0.2)', borderRadius: 12, padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, color: '#B8B4A8', fontWeight: 500, margin: 0 }}>Crypto</h3>
            <p style={{ fontSize: 11, color: '#6B7280', margin: '4px 0 0', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
              bitFlyer · 5分足 RSI / 出来高 / マクロ指標
            </p>
          </div>
          <CryptoDashboard />
        </div>

      </div>
    </div>
  )
}
