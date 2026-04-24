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
        <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
      </head>
      <body style={{ background: '#0D0F14', margin: 0 }}>
        {children}
      </body>
    </html>
  )
}
