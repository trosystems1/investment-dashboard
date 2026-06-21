'use client'

import PerRanking from '@/components/PerRanking'

export default function AnalysisPage() {
  return (
    <div className="p-4 md:p-6" style={{ minHeight: '100vh', background: '#0D0F14', color: '#E8E4D9' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#E8E4D9', margin: 0 }}>分析</h2>
          <p style={{ fontSize: 11, color: '#6B7280', margin: '4px 0 0', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            Equity Analysis
          </p>
          <p style={{ fontSize: 12, color: '#4B5563', marginTop: 8 }}>銘柄スクリーニング・バリュエーション指標</p>
        </div>

        <PerRanking />
      </div>
    </div>
  )
}
