import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch('https://n8n.srv958101.hstgr.cloud/webhook/nakajima-digest', {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return NextResponse.json({ entries: [], count: 0 })
    const data = await res.json()
    return NextResponse.json({ entries: data.entries ?? [], count: data.count ?? 0 })
  } catch {
    return NextResponse.json({ entries: [], count: 0 })
  }
}
