import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

const TICKER_MAP: Record<string, string> = {
  "2010401054559": "228A.T",
  "1010001116826": "4397.T",
  "4010001120965": "4443.T",
  "6011101063359": "3994.T",
  "5010001072207": "4776.T",
}

export async function GET() {
  if (!process.env.NENKIN_DATABASE_URL) {
    return NextResponse.json({ data: [] })
  }
  try {
    const sql = neon(process.env.NENKIN_DATABASE_URL)
    const rows = await sql`
      SELECT 
        c.name,
        c.corporate_number,
        nr1.insured_count as current_count,
        nr2.insured_count as prev_count,
        nr1.record_date
      FROM companies c
      JOIN nenkin_records nr1 ON nr1.company_id = c.id
      JOIN nenkin_records nr2 ON nr2.company_id = c.id
      WHERE nr1.record_date = (SELECT MAX(record_date) FROM nenkin_records WHERE company_id = c.id)
        AND nr2.record_date = (SELECT MAX(record_date) FROM nenkin_records WHERE company_id = c.id AND record_date < (SELECT MAX(record_date) FROM nenkin_records WHERE company_id = c.id))
      ORDER BY ((nr1.insured_count - nr2.insured_count)::float / nr2.insured_count) DESC
    `
    const data = rows.map((r: any) => ({
      name: r.name,
      ticker: TICKER_MAP[r.corporate_number] || null,
      currentCount: r.current_count,
      prevCount: r.prev_count,
      changeCount: r.current_count - r.prev_count,
      changePct: parseFloat(((r.current_count - r.prev_count) / r.prev_count * 100).toFixed(1)),
      recordDate: r.record_date,
    }))
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
