'use client'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'

const NAV_ITEMS = [
  { label: 'Market',    href: '/' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'Screener',  href: '/screener' },
  { label: 'Watchlist', href: '/watchlist' },
  { label: '分析',       href: '/analysis' },
  { label: 'コメント',   href: '/analyst-comments' },
  { label: 'Settings',  href: '/settings' },
]

export default function GlobalNav() {
  const pathname = usePathname()
  const { data: session } = useSession()

  if (pathname === '/login') return null

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(13,15,20,0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '0.5px solid rgba(255,255,255,0.07)',
      padding: '0 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 52,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#C49C48', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
          APEX
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} style={{
                fontSize: 12, padding: '6px 14px', borderRadius: 8,
                textDecoration: 'none', fontWeight: active ? 600 : 400,
                color: active ? '#C49C48' : '#6B7280',
                background: active ? 'rgba(196,156,72,0.1)' : 'transparent',
                borderBottom: active ? '2px solid #C49C48' : '2px solid transparent',
                transition: 'all 0.15s',
              }}>
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 11, color: '#4B5563' }}>
          {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
        {session?.user?.image && (
          <img src={session.user.image} alt="avatar"
            style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid rgba(196,156,72,0.3)' }} />
        )}
        {session?.user && (
          <button onClick={() => signOut({ callbackUrl: '/login' })} style={{
            fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#6B7280',
          }}>
            サインアウト
          </button>
        )}
      </div>
    </nav>
  )
}
