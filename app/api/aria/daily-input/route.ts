import { NextResponse } from 'next/server'
import { saveDailyRequest, listDailyRequests, dateJST } from '@/lib/aria-hub'

// GET: 直近のリクエスト一覧を取得（n8n・ダッシュボードページ両方から利用）
export async function GET() {
  const rows = await listDailyRequests(20)
  return NextResponse.json({ requests: rows })
}

// POST: n8nのARIA_Daily_Voice_Input Webhookから中継される
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const content = body.content || body.chatInput || ''
    if (!content || !String(content).trim()) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }
    await saveDailyRequest({
      date: dateJST(),
      content: String(content).trim(),
      source: body.source || 'claude_chat',
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
