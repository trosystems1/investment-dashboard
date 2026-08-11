import { NextResponse } from 'next/server'
import { fetchUSWatchlist } from '@/lib/us-watchlist'

export async function GET() {
  const quotes = await fetchUSWatchlist()
  return NextResponse.json({ quotes })
}
