import { NextResponse } from 'next/server'
import { fetchUSQuote } from '@/lib/us-watchlist'

export async function GET(req: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params
  const quote = await fetchUSQuote(ticker.toUpperCase())
  if (!quote) {
    return NextResponse.json({ error: 'ticker not found' }, { status: 404 })
  }
  return NextResponse.json({ quote })
}
