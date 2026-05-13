'use client'

interface KpiCardProps {
  label: string
  value: string
  badge?: string
  badgeUp?: boolean
  isGold?: boolean
}

export default function KpiCard({ label, value, badge, badgeUp, isGold }: KpiCardProps) {
  return (
    <div
      className="card"
      style={{
        padding: '16px 18px',
        borderColor: isGold ? 'rgba(196,156,72,0.3)' : undefined,
        background: isGold ? 'rgba(196,156,72,0.05)' : undefined,
      }}
    >
      <div style={{ fontSize: 11, color: '#6B7280', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 24, color: isGold ? '#C49C48' : '#E8E4D9', lineHeight: 1 }}>
        {value}
      </div>
      {badge && (
        <div
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 11, marginTop: 6, padding: '2px 8px', borderRadius: 10,
            background: badgeUp ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
            color: badgeUp ? '#4ADE80' : '#F87171',
          }}
        >
          {badgeUp ? '▲' : '▼'} {badge}
        </div>
      )}
    </div>
  )
}
