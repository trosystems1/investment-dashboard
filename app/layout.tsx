import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'APEX Investment Dashboard',
  description: 'Private Wealth Portfolio',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+JP:wght@300;400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ background: '#0D0F14', margin: 0, fontFamily: "'Inter', 'Noto Sans JP', sans-serif" }}>
        {children}
      </body>
    </html>
  )
}
