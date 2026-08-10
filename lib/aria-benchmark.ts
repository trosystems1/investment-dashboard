import axios from 'axios'
import * as cheerio from 'cheerio'

// ベンチマーク対象チャンネル（順一さんが選定）
// 追加・削除はここを編集するだけでOK
const BENCHMARK_CHANNELS = [
  { name: 'ばっちゃま', handleUrl: 'https://www.youtube.com/@bacchama' },
  { name: '投資アスクワン', handleUrl: 'https://www.youtube.com/@info_ask1' },
]

const N8N_BENCHMARK_WEBHOOK_URL = 'https://n8n.srv958101.hstgr.cloud/webhook/aria-benchmark-ingest'
const GEMINI_MODEL = 'gemini-2.5-flash'
const MAX_VIDEOS_PER_CHANNEL = 2

export interface BenchmarkInsight {
  channelName: string
  videoTitle: string
  focusThemes: string
  sourceUrl: string
}

// 1. @handle URLからチャンネルIDを取得
async function resolveChannelId(handleUrl: string): Promise<string | null> {
  try {
    const res = await axios.get(handleUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ARIA-Benchmark-Bot/1.0)' },
      timeout: 8000,
    })
    const match = res.data.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/)
    return match ? match[1] : null
  } catch (e) {
    console.error(`[aria-benchmark] resolveChannelId failed for ${handleUrl}`, e)
    return null
  }
}

// 2. チャンネルIDから直近の動画URL一覧を取得（RSSフィード、APIキー不要）
async function getRecentVideoUrls(channelId: string, limit: number): Promise<{ title: string; url: string }[]> {
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    const res = await axios.get(rssUrl, { timeout: 8000 })
    const $ = cheerio.load(res.data, { xmlMode: true })
    const videos: { title: string; url: string }[] = []
    $('entry').each((i, el) => {
      if (videos.length >= limit) return
      const title = $(el).find('title').first().text()
      const videoId = $(el).find('yt\\:videoId').first().text()
      if (title && videoId) {
        videos.push({ title, url: `https://www.youtube.com/watch?v=${videoId}` })
      }
    })
    return videos
  } catch (e) {
    console.error(`[aria-benchmark] getRecentVideoUrls failed for ${channelId}`, e)
    return []
  }
}

// 3. Gemini APIで動画を直接読解し、注目テーマを抽出
async function analyzeVideoWithGemini(videoUrl: string, channelName: string, title: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('[aria-benchmark] GEMINI_API_KEY is not set')
    return null
  }

  const prompt = `あなたは米国株投資系YouTubeチャンネルの分析officerです。以下の動画（チャンネル: ${channelName}、タイトル: ${title}）を視聴し、
この動画が「どんなテーマ・切り口」で米国市場を語っているかを、日本語で3〜5個の短い箇条書きで抽出してください。
個別銘柄名・マクロ経済テーマ・その日の注目ニュースなど、具体的な切り口を優先してください。
出力は箇条書きテキストのみ（見出しや前置きは不要）。`

  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [
              { fileData: { fileUri: videoUrl } },
              { text: prompt },
            ],
          },
        ],
      },
      { timeout: 55000 }
    )
    const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text
    return text ? String(text).trim() : null
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[aria-benchmark] Gemini analysis failed for ${videoUrl}: ${msg}`)
    return null
  }
}

// 4. 全チャンネルを処理し、insightsを収集
export async function collectBenchmarkInsights(): Promise<{ insights: BenchmarkInsight[]; errors: string[] }> {
  const insights: BenchmarkInsight[] = []
  const errors: string[] = []

  for (const channel of BENCHMARK_CHANNELS) {
    const channelId = await resolveChannelId(channel.handleUrl)
    if (!channelId) {
      errors.push(`${channel.name}: channelId解決失敗`)
      continue
    }

    const videos = await getRecentVideoUrls(channelId, MAX_VIDEOS_PER_CHANNEL)
    if (videos.length === 0) {
      errors.push(`${channel.name}: 動画取得0件`)
      continue
    }

    for (const video of videos) {
      const focusThemes = await analyzeVideoWithGemini(video.url, channel.name, video.title)
      if (focusThemes) {
        insights.push({
          channelName: channel.name,
          videoTitle: video.title,
          focusThemes,
          sourceUrl: video.url,
        })
      } else {
        errors.push(`${channel.name} / ${video.title}: Gemini解析失敗`)
      }
    }
  }

  return { insights, errors }
}

// 5. n8nのARIA_Benchmark_Ingest Webhookへ送信
export async function pushInsightsToN8n(insights: BenchmarkInsight[]): Promise<void> {
  if (insights.length === 0) return
  await axios.post(N8N_BENCHMARK_WEBHOOK_URL, { insights }, { timeout: 15000 })
}
