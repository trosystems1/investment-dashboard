type SbConfig = { url: string; key: string }

export function supabaseConfig(): SbConfig | null {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return { url, key }
}

export function requireSupabase(): SbConfig {
  const cfg = supabaseConfig()
  if (!cfg) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です')
  return cfg
}

export async function sb<T>(
  path: string,
  init: RequestInit & { prefer?: string } = {},
): Promise<{ data: T | null; error: string | null; count: number | null }> {
  const cfg = requireSupabase()
  const headers: Record<string, string> = {
    apikey: cfg.key,
    Authorization: `Bearer ${cfg.key}`,
    'Content-Type': 'application/json',
  }
  if (init.prefer) headers.Prefer = init.prefer
  if (init.headers) Object.assign(headers, init.headers)

  const res = await fetch(`${cfg.url}/rest/v1/${path}`, { ...init, headers })
  const text = await res.text()
  const range = res.headers.get('content-range')
  const countPart = range?.split('/')[1]
  const count = countPart && countPart !== '*' ? Number(countPart) : null
  if (!res.ok) return { data: null, error: text.slice(0, 400), count }
  if (!text) return { data: null, error: null, count }
  return { data: JSON.parse(text) as T, error: null, count }
}
