'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'

const NAV_ITEMS = [
  { label: 'ホーム',       href: '/' },
  { label: 'ウォッチリスト', href: '/watchlist' },
  { label: 'コメント',     href: '/analyst-comments' },
  { label: 'ポートフォリオ', href: '/portfolio' },
  { label: 'アナリシス',   href: '/analysis' },
  { label: 'スクリーナー', href: '/screener' },
  { label: 'セッティング', href: '/settings' },
]

export default function GlobalNav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)

  useEffect(() => { setOpen(false) }, [pathname])

  if (pathname === '/login') return null

  return (
    <>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(13,15,20,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '0.5px solid rgba(255,255,255,0.07)',
        padding: '0 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 52,
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button
            onClick={() => setOpen(v => !v)}
            aria-label="メニュー"
            className="flex md:hidden"
            style={{
              width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', cursor: 'pointer', color: '#C49C48',
              marginRight: 6, padding: 0,
            }}
          >
            {open ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M2 2L16 16M16 2L2 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M2 5h16M2 10h16M2 15h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            )}
          </button>

          <span style={{ fontSize: 14, fontWeight: 700, color: '#C49C48', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
            APEX
          </span>

          <div className="hidden md:flex" style={{ gap: 4, marginLeft: 32 }}>
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
          <span className="hidden sm:inline-block" style={{ fontSize: 11, color: '#4B5563' }}>
            {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
          {session?.user?.image && (
            <img src={session.user.image} alt="avatar"
              style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid rgba(196,156,72,0.3)' }} />
          )}
          {session?.user && (
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="hidden sm:inline-block" style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#6B7280',
            }}>
              サインアウト
            </button>
          )}
        </div>
      </nav>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="md:hidden"
          style={{ position: 'fixed', inset: 0, top: 52, zIndex: 99, background: 'rgba(13,15,20,0.6)' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#13161E', borderBottom: '0.5px solid rgba(255,255,255,0.07)', padding: '8px 0' }}
          >
            {NAV_ITEMS.map(item => {
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)} style={{
                  display: 'block',
                  fontSize: 14, padding: '14px 20px',
                  textDecoration: 'none', fontWeight: active ? 600 : 400,
                  color: active ? '#C49C48' : '#B8B4A8',
                  background: active ? 'rgba(196,156,72,0.08)' : 'transparent',
                  borderLeft: active ? '3px solid #C49C48' : '3px solid transparent',
                }}>
                  {item.label}
                </Link>
              )
            })}
            <div style={{
              borderTop: '0.5px solid rgba(255,255,255,0.06)', margin: '8px 20px 0', paddingTop: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 11, color: '#4B5563' }}>
                {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
              {session?.user && (
                <button onClick={() => signOut({ callbackUrl: '/login' })} style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#6B7280',
                }}>
                  サインアウト
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
