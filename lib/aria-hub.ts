// ARIA向け「日次リクエスト」「競合分析」を一元管理するSupabaseアクセス層
// 保存はSupabase REST(PostgREST)を直接叩く既存パターン(lib/aria-daily.ts)を踏襲

function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return { url, key }
}

export function dateJST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

// ── 日次リクエスト（順一さんの音声インプット）─────────────────────────
export type DailyRequestRecord = {
  date: string
  content: string
  source?: string
}

export type DailyRequestRow = DailyRequestRecord & { id: number; created_at: string }

export async function saveDailyRequest(record: DailyRequestRecord): Promise<void> {
  const cfg = supabaseConfig()
  if (!cfg) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です')
  const { url, key } = cfg
  const res = await fetch(`${url}/rest/v1/aria_daily_requests`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ date: record.date, content: record.content, source: record.source || 'claude_chat' }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase save failed: ${res.status} ${err.slice(0, 300)}`)
  }
}

export async function listDailyRequests(limit = 20): Promise<DailyRequestRow[]> {
  const cfg = supabaseConfig()
  if (!cfg) return []
  const { url, key } = cfg
  const res = await fetch(`${url}/rest/v1/aria_daily_requests?select=*&order=date.desc,created_at.desc&limit=${limit}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    next: { revalidate: 60 },
  })
  if (!res.ok) return []
  return res.json()
}

// ── 競合ベンチマーク分析（Gemini解析結果）─────────────────────────────
export type BenchmarkInsightRecord = {
  analysisDate: string
  channelName: string
  videoTitle: string
  focusThemes: string
  sourceUrl: string
}

export type BenchmarkInsightRow = {
  id: number
  analysis_date: string
  channel_name: string
  video_title: string
  focus_themes: string
  source_url: string
  created_at: string
}

export async function saveBenchmarkInsights(records: BenchmarkInsightRecord[]): Promise<void> {
  if (records.length === 0) return
  const cfg = supabaseConfig()
  if (!cfg) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です')
  const { url, key } = cfg
  const rows = records.map(r => ({
    analysis_date: r.analysisDate,
    channel_name: r.channelName,
    video_title: r.videoTitle,
    focus_themes: r.focusThemes,
    source_url: r.sourceUrl,
  }))
  const res = await fetch(`${url}/rest/v1/aria_benchmark_insights`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase save failed: ${res.status} ${err.slice(0, 300)}`)
  }
}

export async function listBenchmarkInsights(limit = 20): Promise<BenchmarkInsightRow[]> {
  const cfg = supabaseConfig()
  if (!cfg) return []
  const { url, key } = cfg
  const res = await fetch(`${url}/rest/v1/aria_benchmark_insights?select=*&order=analysis_date.desc,created_at.desc&limit=${limit}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    next: { revalidate: 60 },
  })
  if (!res.ok) return []
  return res.json()
}
