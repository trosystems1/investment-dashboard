import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { loadAreaAdjusted } from '@/lib/fudosan/area-adjusted'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * 築年調整後のエリア指数を JSON で返す（画面 /fudosan/areas と同じ計算・同じキャッシュ）。
 * n8n や確認用。ログイン画面を通らないので x-ingest-secret で守る。
 *
 * ?refresh=1 で1日キャッシュを捨てて作り直す（成約データを取り込み直したあとに使う）。
 * ?q=旗の台 でエリア名の部分一致に絞る。
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-ingest-secret')
  if (!secret || secret !== process.env.FUDOSAN_INGEST_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  if (req.nextUrl.searchParams.get('refresh') === '1') revalidateTag('fudosan-area-adjusted')

  const res = await loadAreaAdjusted()
  if (!res) return NextResponse.json({ ok: false, error: 'load failed' }, { status: 500 })

  const q = req.nextUrl.searchParams.get('q')
  const rows = q ? res.rows.filter(r => r.district.includes(q) || r.city.includes(q)) : res.rows
  return NextResponse.json({ ok: true, ...res, rows })
}
