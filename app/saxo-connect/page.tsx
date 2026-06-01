'use client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ConnectContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0D0F14',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(196,156,72,0.2)',
          borderRadius: 16,
          padding: '48px 40px',
          textAlign: 'center',
          minWidth: 320,
        }}
      >
        <div style={{ fontSize: 20, color: '#C49C48', fontWeight: 600, marginBottom: 8 }}>SAXO接続</div>
        <div style={{ fontSize: 13, color: '#4B5563', marginBottom: 32 }}>
          サクソバンク証券の本番口座と接続します
        </div>
        {error && (
          <div style={{ color: '#F87171', fontSize: 12, marginBottom: 16 }}>
            エラーが発生しました。再度お試しください。
          </div>
        )}
        <a
          href="/api/saxo/auth"
          style={{
            display: 'block',
            background: 'rgba(196,156,72,0.15)',
            border: '1px solid rgba(196,156,72,0.3)',
            borderRadius: 8,
            color: '#C49C48',
            padding: '12px 32px',
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          サクソバンクでログイン
        </a>
      </div>
    </div>
  )
}

export default function SaxoConnectPage() {
  return (
    <Suspense>
      <ConnectContent />
    </Suspense>
  )
}
