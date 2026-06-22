import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { sendLINE } from '@/lib/line';
import { buildSignalsFromHistory, dateJST } from '@/lib/signal-run';
import { saveAnalystComment } from '@/lib/analyst-comments';

const redis = Redis.fromEnv();

const DEFAULT_TICKERS = ['228A0', '43970', '43740', '431A0', '44430', '44780', '39940', '47760', '40580', '48110'];

async function fetchBars(ticker: string, days: number = 30) {
  const apiKey = process.env.JQUANTS_API_KEY;
  const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
  const to   = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const res = await fetch(
    `https://api.jquants.com/v2/equities/bars/daily?code=${ticker}&from=${from}&to=${to}`,
    { headers: { 'x-api-key': apiKey! } }
  );
  const data = await res.json();
  console.log(`[fetchBars:${ticker}] status:${res.status} raw:${JSON.stringify(data).slice(0, 200)}`);
  if (!res.ok) return null;
  const rows = (data.bars ?? data.data ?? []) as Array<{ Date: string; C: number; Vo: number }>;
  return rows.map(r => ({ date: r.Date, close: r.C, volume: r.Vo }));
}

async function fetchCompanyName(ticker: string): Promise<string | null> {
  const apiKey = process.env.JQUANTS_API_KEY;
  const codeWithoutSuffix = ticker.endsWith('0') ? ticker.slice(0, -1) : ticker;
  const res = await fetch(
    `https://api.jquants.com/v2/equities/master?code=${codeWithoutSuffix}`,
    { headers: { 'x-api-key': apiKey! } }
  );
  const data = await res.json();
  if (!res.ok) return null;
  return data.data?.[0]?.CoName ?? data.master?.[0]?.CoName ?? null;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronHeader = req.headers.get('x-vercel-cron');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && cronHeader !== '1') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [rules, savedTickers] = await Promise.all([
    redis.get<string[]>('signal:rules'),
    redis.get<string[]>('signal:watchlist'),
  ]);

  const prompt = !rules || rules.length === 0
    ? await redis.get<string>('signal:prompt')
    : null;
  const activeRules = (rules && rules.length > 0) ? rules : (prompt ? [prompt] : []);

  if (activeRules.length === 0) {
    return NextResponse.json({ skipped: 'No signal rules configured' });
  }

  const tickers = (savedTickers && savedTickers.length > 0) ? savedTickers : DEFAULT_TICKERS;
  const signals: string[] = [];
  const today = dateJST();

  for (const ticker of tickers) {
    const bars = await fetchBars(ticker, 30);
    console.log(`[${ticker}] bars count:`, bars?.length ?? 'null');
    if (!bars || bars.length < 5) continue;

    // 会社名をキャッシュ（未登録なら取得して保存）
    let companyName = await redis.get<string>(`company:${ticker}`);
    if (!companyName) {
      const fetched = await fetchCompanyName(ticker);
      if (fetched) {
        companyName = fetched;
        await redis.set(`company:${ticker}`, fetched, { ex: 86400 * 30 });
      } else {
        companyName = ticker;
      }
    }

    const recentBars = bars.slice(-25).map(b => ({
      date: b.date, close: b.close, volume: b.volume,
    }));

    const rulesText = activeRules.map((r, i) => `${i + 1}. ${r}`).join('\n');

    const userMessage = `
以下は ${ticker}（${companyName}）の直近の株価データ（日次）です。
${JSON.stringify(recentBars, null, 2)}

【シグナル検出ルール一覧】
${rulesText}

---
上記の各ルールについて判断し、シグナルが発生しているものだけを以下の形式で列挙してください。
SIGNAL: [ルール番号] [シグナル名] - [理由を1行で]

シグナルが1件もない場合は NO_SIGNAL とだけ回答してください。
`.trim();

    try {
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          messages: [{ role: 'user', content: userMessage }],
        }),
      });
      const claudeData = await claudeRes.json();
      const text: string = claudeData.content?.[0]?.text ?? '';
      console.log(`[${ticker}] Claude response:`, text);

      // 銘柄ごとの履歴をRedisに保存（最大30件）
      const history = await redis.get<Array<{ date: string; signals: string[]; checkedAt: string }>>(`signal:history:${ticker}`) ?? [];
      const detectedSignals = text.includes('SIGNAL:')
        ? text.split('\n').filter(l => l.includes('SIGNAL:')).map(l => l.replace('SIGNAL:', '').trim())
        : [];

      // 同日のエントリは上書き
      const existingIndex = history.findIndex(h => h.date === today);
      const newEntry = { date: today, signals: detectedSignals, checkedAt: new Date().toISOString() };
      if (existingIndex >= 0) {
        history[existingIndex] = newEntry;
      } else {
        history.unshift(newEntry); // 新しい順
      }
      // 最大30件保持
      const trimmed = history.slice(0, 30);
      await redis.set(`signal:history:${ticker}`, trimmed);

      if (detectedSignals.length > 0) {
        signals.push(`📈 ${companyName}（${ticker}）\n${detectedSignals.join('\n')}`);
      }
    } catch (e) {
      console.error(`Claude error for ${ticker}:`, e);
    }
  }

  if (signals.length > 0) {
    const message = `🔔 株価シグナル検出 (${today})\n\n${signals.join('\n\n')}`;
    await sendLINE(message);
  }

  const reconciledSignals = await buildSignalsFromHistory(redis, tickers, today);

  await redis.set('signal:last_run', {
    timestamp: new Date().toISOString(),
    signalCount: reconciledSignals.length,
    signals: reconciledSignals,
    tickerCount: tickers.length,
    ruleCount: activeRules.length,
  });

  const commentDate = today.replace(/\//g, '-');
  const stockContent =
    reconciledSignals.length > 0
      ? `🔔 株価シグナル検出 (${today})\n\n${reconciledSignals.join('\n\n')}`
      : `✓ 株価シグナルなし (${today}) — ${tickers.length}銘柄チェック`;

  await saveAnalystComment({
    source: 'stock_signal',
    comment_date: commentDate,
    title: reconciledSignals.length > 0 ? `株シグナル ${reconciledSignals.length}件` : '株シグナルなし',
    content: stockContent,
    metadata: {
      signalCount: reconciledSignals.length,
      tickerCount: tickers.length,
      ruleCount: activeRules.length,
      signals: reconciledSignals,
    },
  });

  return NextResponse.json({
    success: true,
    signalCount: reconciledSignals.length,
    signals: reconciledSignals,
    tickerCount: tickers.length,
    ruleCount: activeRules.length,
  });
}
