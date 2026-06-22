/**
 * 過去ログを analyst_comments にバックフィル（読み取り専用で Redis / Supabase を参照）
 *
 * 実行: npx tsx scripts/backfill-analyst-comments.ts
 * 要: .env.local に SUPABASE_* / UPSTASH_REDIS_*
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

const DEFAULT_TICKERS = ['228A0', '43970', '43740', '431A0', '44430', '44780', '39940', '47760', '40580', '48110']

function normalizeDate(d: string): string {
  return d.replace(/\//g, '-')
}

async function main() {
  const { Redis } = await import('@upstash/redis')
  const { saveAnalystComment } = await import('../lib/analyst-comments')
  const { listMorningSummaries } = await import('../lib/nikkei-morning-summary')
  const { getCryptoSettings, getHistory } = await import('../lib/crypto-signal-store')

  console.log('Backfilling analyst_comments...')

  const rows = await listMorningSummaries(400)
  let nikkei = 0
  for (const row of rows) {
    if (!row.summary_text) continue
    const ok = await saveAnalystComment({
      source: 'nikkei_option',
      comment_date: normalizeDate(String(row.date)),
      title: '日経225オプション朝サマリー',
      content: row.summary_text,
      metadata: {
        nikkei_close: row.nikkei_close,
        nikkei_vi: row.nikkei_vi,
        sq_days_remaining: row.sq_days_remaining,
        backfill: true,
      },
    })
    if (ok) nikkei += 1
  }
  console.log(`  nikkei_option: ${nikkei} rows`)

  const redis = Redis.fromEnv()
  const tickers = (await redis.get<string[]>('signal:watchlist')) ?? DEFAULT_TICKERS
  const byDate = new Map<string, string[]>()
  for (const ticker of tickers) {
    const [history, companyName] = await Promise.all([
      redis.get<Array<{ date: string; signals: string[] }>>(`signal:history:${ticker}`),
      redis.get<string>(`company:${ticker}`),
    ])
    for (const entry of history ?? []) {
      if (!entry.signals?.length) continue
      const date = normalizeDate(entry.date)
      const block = `📈 ${companyName ?? ticker}（${ticker}）\n${entry.signals.join('\n')}`
      const list = byDate.get(date) ?? []
      list.push(block)
      byDate.set(date, list)
    }
  }
  let stock = 0
  for (const [date, signals] of byDate) {
    const ok = await saveAnalystComment({
      source: 'stock_signal',
      comment_date: date,
      title: `株シグナル ${signals.length}件`,
      content: `🔔 株価シグナル検出 (${date})\n\n${signals.join('\n\n')}`,
      metadata: { signalCount: signals.length, backfill: true },
    })
    if (ok) stock += 1
  }
  console.log(`  stock_signal: ${stock} days (signals only)`)

  const settings = await getCryptoSettings()
  const cryptoByDate = new Map<string, string[]>()
  for (const productCode of settings.productCodes) {
    const history = await getHistory(productCode)
    for (const entry of history) {
      const date = new Date(entry.timestamp).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
      const line = `${entry.timestamp.slice(11, 16)} ${productCode}: RSI ${entry.rsi ?? '—'}, Vol ${entry.volumeRatio ?? '—'}x — ${
        entry.triggered ? (entry.notified ? '🔔' : 'シグナル') : entry.reason
      }`
      const list = cryptoByDate.get(date) ?? []
      list.push(line)
      cryptoByDate.set(date, list)
    }
  }
  let crypto = 0
  for (const [date, lines] of cryptoByDate) {
    const triggered = lines.filter((l) => l.includes('🔔') || l.includes('シグナル'))
    const ok = await saveAnalystComment({
      source: 'crypto_signal',
      comment_date: date,
      title: triggered.length > 0 ? 'Cryptoシグナル（履歴）' : 'Cryptoチェック（履歴）',
      content: [`仮想通貨シグナル履歴 (${date})`, '', ...lines.reverse()].join('\n'),
      metadata: { backfill: true, lineCount: lines.length },
    })
    if (ok) crypto += 1
  }
  console.log(`  crypto_signal: ${crypto} days (Redis履歴の範囲内)`)

  console.log('Done. 復元できない期間は今後の Cron から記録されます。')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
