import axios from 'axios'
import * as cheerio from 'cheerio'

// ベンチマーク対象チャンネル（順一さんが選定）
// 追加・削除はここを編集するだけでOK
//
// 【2026-09-26 修正】チャンネルIDを固定する。
// 旧実装は @handle のページHTMLから最初に見つかった "channelId" を拾っていたが、
// ページには関連チャンネル等のIDも載っており、ばっちゃまでは更新の止まった別チャンネルのIDを拾っていた可能性が高い。
// その結果、8/12〜9/25の約6週間、同じ動画（【米国株 11/16】… / _XZBfHh_l2M）を毎回分析していた。
// IDは 2026-09-26 に各チャンネルページで確認済み。
//
// mode:
//   'video' … Gemini に動画そのものを読ませる（短めの動画向け）
//   'text'  … RSS のタイトル＋説明文から要点を取る（長い動画で25秒の時間切れになるチャンネル向け）
// maxAgeDays: これより古い動画しか無ければ「古い」と判定して使わない（黙って古い動画を使い続けない）
const BENCHMARK_CHANNELS = [
  { name: 'ばっちゃま', handleUrl: 'https://www.youtube.com/@bacchama', channelId: 'UCzZSnddt3xTL0V-ELJaMUFw', mode: 'video' as const, maxAgeDays: 3 },
  // 朝倉慶のASK1。毎週金曜夕方更新・長尺のため、動画解析は時間切れで8/12以降一度も取れていなかった。
  { name: '投資アスクワン', handleUrl: 'https://www.youtube.com/@info_ask1', channelId: 'UCax09PmcRoY1R8mfJFBfv0g', mode: 'text' as const, maxAgeDays: 8 },
]

const GEMINI_MODEL = 'gemini-2.5-flash'
const MAX_VIDEOS_PER_CHANNEL = 1

export interface BenchmarkInsight {
  channelName: string
  videoTitle: string
  focusThemes: string
  sourceUrl: string
}

interface FeedVideo {
  title: string
  url: string
  published: Date | null
  description: string
}

// チャンネルIDが未設定のときだけ使う予備の解決処理（通常は使わない）
async function resolveChannelId(handleUrl: string): Promise<string | null> {
  try {
    const res = await axios.get(handleUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ARIA-Benchmark-Bot/1.0)' },
      timeout: 8000,
    })
    // ページ全体の最初の "channelId" は関連チャンネルの場合があるため、チャンネル自身を指すメタ情報を優先する
    const own =
      res.data.match(/<meta itemprop="identifier" content="(UC[a-zA-Z0-9_-]{22})"/) ||
      res.data.match(/"externalId":"(UC[a-zA-Z0-9_-]{22})"/) ||
      res.data.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/)
    return own ? own[1] : null
  } catch (e) {
    console.error(`[aria-benchmark] resolveChannelId failed for ${handleUrl}`, e)
    return null
  }
}

// RSS から動画一覧を取得し、公開日の新しい順に並べて返す（RSSの並び順を前提にしない）
async function getRecentVideos(channelId: string): Promise<FeedVideo[]> {
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    const res = await axios.get(rssUrl, { timeout: 8000 })
    const $ = cheerio.load(res.data, { xmlMode: true })
    const videos: FeedVideo[] = []
    $('entry').each((_, el) => {
      const title = $(el).find('title').first().text()
      const videoId = $(el).find('yt\\:videoId').first().text()
      const publishedText = $(el).find('published').first().text()
      const description = $(el).find('media\\:description').first().text()
      if (title && videoId) {
        const d = publishedText ? new Date(publishedText) : null
        videos.push({
          title,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          published: d && !isNaN(d.getTime()) ? d : null,
          description: description || '',
        })
      }
    })
    videos.sort((a, b) => (b.published?.getTime() ?? 0) - (a.published?.getTime() ?? 0))
    return videos
  } catch (e) {
    console.error(`[aria-benchmark] getRecentVideos failed for ${channelId}`, e)
    return []
  }
}

const PROMPT_HEAD = (channelName: string, title: string) =>
  `あなたは投資系YouTubeチャンネルの分析担当です。以下の動画（チャンネル: ${channelName}、タイトル: ${title}）が` +
  `「どんなテーマ・切り口」で相場を語っているかを、日本語で3〜5個の短い箇条書きで抽出してください。\n` +
  `個別銘柄名・マクロ経済テーマ・その日の注目ニュース・相場への強気/弱気の見方など、具体的な切り口を優先してください。\n` +
  `出力は箇条書きテキストのみ（見出しや前置きは不要）。`

function geminiError(e: unknown): string {
  return axios.isAxiosError(e)
    ? `${e.message} :: ${JSON.stringify(e.response?.data ?? {}).slice(0, 500)}`
    : (e instanceof Error ? e.message : String(e))
}

// Gemini で動画を直接読解する
// 注意: REST(v1beta)を直接叩く場合、パーツのキーはスネークケース(file_data / file_uri)。
//       キャメルケース(fileData / fileUri)は未知フィールド扱いで400になる。
async function analyzeVideoWithGemini(video: FeedVideo, channelName: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) { console.error('[aria-benchmark] GEMINI_API_KEY is not set'); return null }
  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      { contents: [{ parts: [{ file_data: { file_uri: video.url } }, { text: PROMPT_HEAD(channelName, video.title) }] }] },
      { timeout: 25000 }
    )
    const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text
    return text ? String(text).trim() : null
  } catch (e) {
    console.error(`[aria-benchmark] Gemini video analysis failed for ${video.url}: ${geminiError(e)}`)
    return null
  }
}

// タイトル＋説明文から要点を取る（長尺チャンネル向け。数秒で終わる）
async function analyzeTextWithGemini(video: FeedVideo, channelName: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) { console.error('[aria-benchmark] GEMINI_API_KEY is not set'); return null }
  const body =
    PROMPT_HEAD(channelName, video.title) +
    `\n\n動画そのものは見られないため、以下のタイトルと説明文だけから読み取れる範囲で抽出してください。` +
    `説明文に無いことを推測で補わないこと。宣伝・告知・リンクの文言は無視すること。\n\n` +
    `【タイトル】${video.title}\n【説明文】\n${video.description.slice(0, 4000)}`
  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      { contents: [{ parts: [{ text: body }] }] },
      { timeout: 20000 }
    )
    const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text
    return text ? String(text).trim() : null
  } catch (e) {
    console.error(`[aria-benchmark] Gemini text analysis failed for ${video.url}: ${geminiError(e)}`)
    return null
  }
}

function ymdJst(d: Date): string {
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10)
}

// 全チャンネルを処理し、insightsを収集
export async function collectBenchmarkInsights(): Promise<{ insights: BenchmarkInsight[]; errors: string[] }> {
  const insights: BenchmarkInsight[] = []
  const errors: string[] = []

  // Vercel Hobbyの maxDuration=60s に収めるため、チャンネル単位で並列に走らせる。
  const perChannel = await Promise.all(
    BENCHMARK_CHANNELS.map(async (channel) => {
      const localInsights: BenchmarkInsight[] = []
      const localErrors: string[] = []

      const channelId = channel.channelId || (await resolveChannelId(channel.handleUrl))
      if (!channelId) {
        localErrors.push(`${channel.name}: channelId解決失敗`)
        return { localInsights, localErrors }
      }

      const all = await getRecentVideos(channelId)
      if (all.length === 0) {
        localErrors.push(`${channel.name}: 動画取得0件（channelId=${channelId}）`)
        return { localInsights, localErrors }
      }

      // 公開日が maxAgeDays 以内のものだけを使う。古い動画しか無い日は使わずに記録する。
      const now = Date.now()
      const fresh = all.filter(v => v.published && (now - v.published.getTime()) / 86400000 <= channel.maxAgeDays)
      if (fresh.length === 0) {
        const newest = all[0]
        localErrors.push(
          `${channel.name}: ${channel.maxAgeDays}日以内の動画なし（最新=${newest.published ? ymdJst(newest.published) : '日付不明'}「${newest.title}」 channelId=${channelId}）`
        )
        return { localInsights, localErrors }
      }

      for (const video of fresh.slice(0, MAX_VIDEOS_PER_CHANNEL)) {
        const focusThemes = channel.mode === 'text'
          ? await analyzeTextWithGemini(video, channel.name)
          : await analyzeVideoWithGemini(video, channel.name)
        // タイトルに公開日を付けて保存する（n8n側・目視の両方で鮮度が分かるように）
        const titleWithDate = `${video.title}（公開 ${video.published ? ymdJst(video.published) : '日付不明'}）`
        if (focusThemes) {
          localInsights.push({ channelName: channel.name, videoTitle: titleWithDate, focusThemes, sourceUrl: video.url })
        } else {
          localErrors.push(`${channel.name} / ${titleWithDate}: Gemini解析失敗（mode=${channel.mode}）`)
        }
      }
      return { localInsights, localErrors }
    })
  )

  for (const r of perChannel) {
    insights.push(...r.localInsights)
    errors.push(...r.localErrors)
  }
  return { insights, errors }
}
