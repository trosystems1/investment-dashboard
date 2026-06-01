'use client'
import { signIn } from 'next-auth/react'

export default function LoginPage() {
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
        <div style={{ fontSize: 24, color: '#C49C48', fontWeight: 600, marginBottom: 8 }}>APEX</div>
        <div style={{ fontSize: 13, color: '#4B5563', marginBottom: 32 }}>Private Wealth Dashboard</div>
        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          style={{
            background: 'rgba(196,156,72,0.15)',
            border: '1px solid rgba(196,156,72,0.3)',
            borderRadius: 8,
            color: '#C49C48',
            padding: '12px 32px',
            fontSize: 14,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Googleでログイン
        </button>
      </div>
    </div>
  )
}
