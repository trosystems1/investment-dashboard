export type AnalystCommentSource = 'nikkei_option' | 'stock_signal' | 'crypto_signal'

export const SOURCE_LABELS: Record<AnalystCommentSource, string> = {
  nikkei_option: '日経225オプション',
  stock_signal: '株式シグナル',
  crypto_signal: '仮想通貨シグナル',
}

export type AnalystCommentInput = {
  source: AnalystCommentSource
  comment_date: string
  title?: string | null
  content: string
  metadata?: Record<string, unknown> | null
}

export type AnalystCommentRow = AnalystCommentInput & {
  id: number
  created_at: string
}

function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return { url, key }
}

export function commentDateJST(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

/** source + comment_date で upsert（Supabase 未設定時は false） */
export async function saveAnalystComment(input: AnalystCommentInput): Promise<boolean> {
  const cfg = supabaseConfig()
  if (!cfg) {
    console.warn('[analyst-comments] Supabase not configured, skip save')
    return false
  }

  const { url, key } = cfg
  const existing = await fetch(
    `${url}/rest/v1/analyst_comments?source=eq.${input.source}&comment_date=eq.${input.comment_date}&select=id`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  )
  const rows = await existing.json()
  const hasRow = Array.isArray(rows) && rows.length > 0

  const body = {
    source: input.source,
    comment_date: input.comment_date,
    title: input.title ?? null,
    content: input.content,
    metadata: input.metadata ?? null,
  }

  const endpoint = hasRow
    ? `${url}/rest/v1/analyst_comments?source=eq.${input.source}&comment_date=eq.${input.comment_date}`
    : `${url}/rest/v1/analyst_comments`

  const res = await fetch(endpoint, {
    method: hasRow ? 'PATCH' : 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[analyst-comments] save failed:', res.status, err.slice(0, 300))
    return false
  }
  return true
}

export async function listAnalystComments(options: {
  source?: AnalystCommentSource | 'all'
  limit?: number
  offset?: number
}): Promise<{ rows: AnalystCommentRow[]; configured: boolean }> {
  const cfg = supabaseConfig()
  if (!cfg) return { rows: [], configured: false }

  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100)
  const offset = Math.max(options.offset ?? 0, 0)
  const { url, key } = cfg

  let query = `${url}/rest/v1/analyst_comments?select=*&order=comment_date.desc,created_at.desc&limit=${limit}&offset=${offset}`
  if (options.source && options.source !== 'all') {
    query += `&source=eq.${options.source}`
  }

  const res = await fetch(query, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    next: { revalidate: 60 },
  })
  if (!res.ok) return { rows: [], configured: true }
  const rows = await res.json()
  return { rows, configured: true }
}
