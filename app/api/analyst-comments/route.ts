import { NextResponse } from 'next/server'
import {
  AnalystCommentSource,
  listAnalystComments,
} from '@/lib/analyst-comments'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const source = (searchParams.get('source') || 'all') as AnalystCommentSource | 'all'
  let limit = parseInt(searchParams.get('limit') || '20', 10)
  let offset = parseInt(searchParams.get('offset') || '0', 10)
  if (Number.isNaN(limit)) limit = 20
  if (Number.isNaN(offset)) offset = 0

  const validSources = ['nikkei_option', 'stock_signal', 'crypto_signal', 'all']
  const filter = validSources.includes(source) ? source : 'all'

  const { rows, configured } = await listAnalystComments({
    source: filter,
    limit,
    offset,
  })

  if (!configured) {
    return NextResponse.json({
      comments: [],
      configured: false,
      message: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です',
    })
  }

  return NextResponse.json({
    comments: rows,
    configured: true,
    limit,
    offset,
    hasMore: rows.length === limit,
  })
}
