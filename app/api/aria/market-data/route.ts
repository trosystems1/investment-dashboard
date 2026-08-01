// app/api/aria/market-data/route.ts
// n8nのARIAワークフローが叩くエンドポイント
// 認証: Authorization: Bearer {ARIA_API_SECRET} ヘッダー
//
// GET /api/aria/market-data          → 当日（JST）の最新データを返す
// GET /api/aria/market-data?date=2026-08-01 → 指定日のデータを返す

import { NextResponse } from 'next/server'
import { listAriaDailyInsights } from '@/lib/aria-daily'

export const revalidate = 0

export async function GET(req: Request) {
  // Bearer認証（ARIA_API_SECRETをVercel環境変数に設定）
  const secret = process.env.ARIA_API_SECRET
  if (secret) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const { searchParams } = new URL(req.url)
  const dateParam = searchParams.get('date') // YYYY-MM-DD、省略時は当日JST

  // 最新30件を取得してdate絞り込み
  const rows = await listAriaDailyInsights(30)
  if (rows.length === 0) {
    return NextResponse.json({ error: 'No data available' }, { status: 404 })
  }

  const target = dateParam ?? rows[0].date // 省略時は最新
  const row = rows.find(r => r.date === target) ?? rows[0]

  // n8nが使いやすいフラット構造に整形して返す
  const stocks: Record<string, { close: number; change: number; changePct: number }> = {}
  for (const s of row.stock_quotes ?? []) {
    stocks[s.symbol] = { close: s.close, change: s.change, changePct: s.changePct }
  }

  // 最大変動銘柄を計算
  const sortedByMove = [...(row.stock_quotes ?? [])].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
  const bigMover  = sortedByMove[0]  ?? null
  const bigGainer = sortedByMove.find(s => s.changePct > 0) ?? null
  const bigLoser  = sortedByMove.filter(s => s.changePct < 0).at(-1) ?? null // 最大下落

  return NextResponse.json({
    date:   row.date,
    // 指数（period change）
    sp500: {
      changePct1m: row.sp500_change_pct_1m,
      changePct3m: row.sp500_change_pct_3m,
    },
    nasdaq: {
      changePct1m: row.nasdaq_change_pct_1m,
      changePct3m: row.nasdaq_change_pct_3m,
    },
    // セクター
    sectors:    row.sector_changes ?? [],
    // 日米連動
    comovement: row.comovement,
    // 個別株（トップ50）
    stocks,
    bigMover,
    bigGainer,
    bigLoser: bigLoser ? { ...bigLoser, changePct: bigLoser.changePct } : null,
    // 決算カレンダー（トップ50フィルター済み）
    earnings: row.earnings ?? [],
    // ARIA音声生成用facts
    facts:    row.facts,
  })
}
