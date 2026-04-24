'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const ALLOC = [
  { name: '国内株式', value: 35, color: '#C49C48' },
  { name: '海外株式', value: 20, color: '#3B82F6' },
  { name: '債券', value: 20, color: '#10B981' },
  { name: 'オルタナ', value: 15, color: '#8B5CF6' },
  { name: 'キャッシュ', value: 10, color: '#4B5563' },
]

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background: 'rgba(13,15,20,0.95)', border: '0.5px solid rgba(196,156,72,0.3)',
      padding: '8px 12px', borderRadius: 8, fontSize: 12,
    }}>
      <span style={{ color: d.color }}>■</span>
      <span style={{ color: '#E8E4D9', marginLeft: 6 }}>{d.name}: {d.value}%</span>
    </div>
  )
}

export default function AllocationChart() {
  return (
    <div>
      <div style={{ fontSize: 14, color: '#B8B4A8', fontWeight: 500, marginBottom: 16 }}>Asset Allocation</div>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={ALLOC}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={72}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {ALLOC.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        {ALLOC.map((a) => (
          <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: a.color, flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: '#B8B4A8', flex: 1 }}>{a.name}</div>
            <div style={{ width: 80, background: 'rgba(255,255,255,0.06)', borderRadius: 3, height: 3 }}>
              <div style={{ width: `${a.value}%`, height: 3, borderRadius: 3, background: a.color }} />
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', minWidth: 30, textAlign: 'right' }}>{a.value}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}
