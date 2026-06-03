import type { Metadata } from "next"
import "./globals.css"
import AuthSessionProvider from "@/components/SessionProvider"
import GlobalNav from "@/components/GlobalNav"

export const metadata: Metadata = {
  title: "APEX Investment Dashboard",
  description: "Private Wealth Portfolio",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+JP:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ background: "#0D0F14", margin: 0, fontFamily: "var(--font-body)" }}>
        <AuthSessionProvider>
          <GlobalNav />
          {children}
        </AuthSessionProvider>
      </body>
    </html>
  )
}
