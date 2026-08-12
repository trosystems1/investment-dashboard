import axios from 'axios'
import * as cheerio from 'cheerio'

// ベンチマーク対象チャンネル（順一さんが選定）
// 追加・削除はここを編集するだけでOK
const BENCHMARK_CHANNELS = [
  { name: 'ばっちゃま', handleUrl: 'https://www.youtube.com/@bacchama' },
  { name: '投資アスクワン', handleUrl: 'https://www.youtube.com/@info_ask1' },
]

const GEMINI_MODEL = 'gemini-2.5-flash'
const MAX_VIDEOS_PER_CHANNEL = 1

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
// 注意: REST(v1beta)を直接叩く場合、パーツのキーはスネークケース(file_data / file_uri)。
//       キャメルケース(fileData / fileUri)は未知フィールド扱いで400になる。
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
              { file_data: { file_uri: videoUrl } },
              { text: prompt },
            ],
          },
        ],
      },
      { timeout: 25000 }
    )
    const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text
    return text ? String(text).trim() : null
  } catch (e) {
    // 400の理由はレスポンスボディに入る。message だけだと原因が分からないため中身を出す。
    const detail = axios.isAxiosError(e)
      ? `${e.message} :: ${JSON.stringify(e.response?.data ?? {}).slice(0, 500)}`
      : (e instanceof Error ? e.message : String(e))
    console.error(`[aria-benchmark] Gemini analysis failed for ${videoUrl}: ${detail}`)
    return null
  }
}

// 4. 全チャンネルを処理し、insightsを収集
export async function collectBenchmarkInsights(): Promise<{ insights: BenchmarkInsight[]; errors: string[] }> {
  const insights: BenchmarkInsight[] = []
  const errors: string[] = []

  // Vercel Hobbyの maxDuration=60s に収めるため、チャンネル解決〜Gemini解析まで全て並列で走らせる。
  // 逐次ループだと動画1本あたり数十秒かかりタイムアウトする。
  const perChannel = await Promise.all(
    BENCHMARK_CHANNELS.map(async (channel) => {
      const localInsights: BenchmarkInsight[] = []
      const localErrors: string[] = []

      const channelId = await resolveChannelId(channel.handleUrl)
      if (!channelId) {
        localErrors.push(`${channel.name}: channelId解決失敗`)
        return { localInsights, localErrors }
      }

      const videos = await getRecentVideoUrls(channelId, MAX_VIDEOS_PER_CHANNEL)
      if (videos.length === 0) {
        localErrors.push(`${channel.name}: 動画取得0件`)
        return { localInsights, localErrors }
      }

      const analyzed = await Promise.all(
        videos.map(async (video) => ({
          video,
          focusThemes: await analyzeVideoWithGemini(video.url, channel.name, video.title),
        }))
      )

      for (const { video, focusThemes } of analyzed) {
        if (focusThemes) {
          localInsights.push({
            channelName: channel.name,
            videoTitle: video.title,
            focusThemes,
            sourceUrl: video.url,
          })
        } else {
          localErrors.push(`${channel.name} / ${video.title}: Gemini解析失敗`)
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
