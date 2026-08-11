import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch('https://n8n.srv958101.hstgr.cloud/webhook/aria-stock-mentions', {
      next: { revalidate: 300 },
    })
    if (!res.ok) return NextResponse.json({ mentions: [], count: 0 })
    const data = await res.json()
    return NextResponse.json({ mentions: data.mentions ?? [], count: data.count ?? 0 })
  } catch {
    return NextResponse.json({ mentions: [], count: 0 })
  }
}
