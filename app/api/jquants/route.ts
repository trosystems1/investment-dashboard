import { NextRequest, NextResponse } from 'next/server'
import { fetchAndStore } from '@/lib/jquants-fetch'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const codes = (searchParams.get('codes') || '228A,4397,4374').split(',')
  const results = await fetchAndStore(codes)
  return NextResponse.json({ data: results, updatedAt: new Date().toISOString() })
}
