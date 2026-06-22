import { NextResponse } from 'next/server'
import {
  evaluateSignal,
  executionsToCandles,
  fetchNewExecutions,
  mergeCandles,
} from '@/lib/crypto-bitflyer'
import {
  appendHistory,
  getCryptoSettings,
  getCursor,
  getCandles,
  getLastSignal,
  isCooldownActive,
  setCandles,
  setCursor,
  setLastRun,
  setLastSignal,
} from '@/lib/crypto-signal-store'
import { sendLINE } from '@/lib/line'
import { saveAnalystComment, commentDateJST } from '@/lib/analyst-comments'

export const maxDuration = 60

function formatPrice(productCode: string, price: number): string {
  if (productCode.endsWith('_JPY')) {
    return `¥${Math.round(price).toLocaleString('ja-JP')}`
  }
  return price.toLocaleString('ja-JP', { maximumFractionDigits: 8 })
}

function formatJST(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-vercel-cron')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && cronHeader !== '1') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const settings = await getCryptoSettings()
  if (!settings.enabled) {
    return NextResponse.json({ skipped: 'Crypto signal disabled in settings' })
  }

  const timestamp = new Date().toISOString()
  const results: Array<{
    productCode: string
    newExecutions: number
    candleCount: number
    evaluation: ReturnType<typeof evaluateSignal>
    notified: boolean
    error?: string
  }> = []

  for (const productCode of settings.productCodes) {
    try {
      const [cursor, existingCandles] = await Promise.all([
        getCursor(productCode),
        getCandles(productCode),
      ])

      const executions = await fetchNewExecutions(productCode, cursor)
      const newCandles = executionsToCandles(executions)
      const candles =
        executions.length > 0 || existingCandles.length === 0
          ? mergeCandles(existingCandles, newCandles)
          : existingCandles

      if (executions.length > 0) {
        const maxId = Math.max(...executions.map((e) => e.id))
        await setCursor(productCode, maxId)
      }
      await setCandles(productCode, candles)

      const evaluation = evaluateSignal(candles, settings)
      let notified = false

      if (evaluation.triggered) {
        const lastSignal = await getLastSignal(productCode)
        const inCooldown = isCooldownActive(lastSignal, settings.notifyCooldownMinutes)

        if (!inCooldown && evaluation.price != null) {
          const message = [
            `🪙 ${productCode} シグナル検知`,
            `価格: ${formatPrice(productCode, evaluation.price)}`,
            `RSI(${settings.rsiPeriod}): ${evaluation.rsi}`,
            `出来高比: ${evaluation.volumeRatio}x (${settings.volumeLookback}本平均)`,
            `時刻: ${formatJST(timestamp)}`,
            '',
            '※個人調査用。投資助言ではありません。',
          ].join('\n')

          await sendLINE(message)
          await setLastSignal({
            timestamp,
            productCode,
            rsi: evaluation.rsi,
            volumeRatio: evaluation.volumeRatio,
            price: evaluation.price,
            message,
          })
          notified = true
        }
      }

      await appendHistory(productCode, {
        timestamp,
        rsi: evaluation.rsi,
        volumeRatio: evaluation.volumeRatio,
        price: evaluation.price,
        triggered: evaluation.triggered,
        reason: evaluation.reason,
        notified,
      })

      results.push({
        productCode,
        newExecutions: executions.length,
        candleCount: candles.length,
        evaluation,
        notified,
      })

      console.log(
        `[crypto-signal:${productCode}] execs=${executions.length} candles=${candles.length} rsi=${evaluation.rsi} vol=${evaluation.volumeRatio}x triggered=${evaluation.triggered} notified=${notified}`,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[crypto-signal:${productCode}] error:`, msg)
      results.push({
        productCode,
        newExecutions: 0,
        candleCount: 0,
        evaluation: {
          rsi: null,
          volumeRatio: null,
          price: null,
          avgVolume: null,
          latestVolume: null,
          triggered: false,
          reason: `error: ${msg}`,
        },
        notified: false,
        error: msg,
      })
    }
  }

  await setLastRun({ timestamp, results })

  const commentDate = commentDateJST()
  const triggered = results.filter((r) => r.evaluation.triggered)
  const lines = results.map((r) => {
    const ev = r.evaluation
    const status = ev.triggered
      ? r.notified
        ? '🔔 LINE通知'
        : 'シグナル（クールダウン中）'
      : ev.reason
    return `${r.productCode}: RSI ${ev.rsi ?? '—'}, Vol ${ev.volumeRatio ?? '—'}x — ${status}`
  })
  const cryptoContent = [`仮想通貨シグナルチェック (${commentDate})`, '', ...lines].join('\n')

  await saveAnalystComment({
    source: 'crypto_signal',
    comment_date: commentDate,
    title: triggered.length > 0 ? `Cryptoシグナル ${triggered.length}件` : 'Cryptoチェック',
    content: cryptoContent,
    metadata: {
      triggeredCount: triggered.length,
      productCount: results.length,
      results: results.map((r) => ({
        productCode: r.productCode,
        triggered: r.evaluation.triggered,
        notified: r.notified,
        rsi: r.evaluation.rsi,
        volumeRatio: r.evaluation.volumeRatio,
      })),
    },
  })

  return NextResponse.json({ timestamp, results })
}
