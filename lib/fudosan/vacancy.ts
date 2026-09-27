// 建物単位の「賃貸募集中の部屋数」を Web 検索で拾う。
//
// 建物の本当の空室数は管理会社しか持っていない。ここで取れるのは
// 「いまポータルに賃貸募集が出ている部屋の数」で、空室率の代理指標として使う。
//
// ポータルを巡回・スクレイピングはしない（プロジェクトの方針）。
// 1物件につき Claude の web_search を数回だけ使い、検索で見える範囲の件数を数える。
// 取れなければ status を not_found / error にして、判定側では減点しない。

import type { Property } from './score';

export type BuildingVacancy = {
  status: 'ok' | 'not_found' | 'error' | 'skipped';
  checked_at: string;
  building_matched?: string | null;  // 検索で一致した建物名
  rent_listings?: number | null;     // 重複を除いた賃貸募集中の部屋数
  total_units?: number | null;       // 検索で見つかった総戸数（マイソクに無いときの補完用）
  confidence?: 'high' | 'medium' | 'low' | null;
  sources?: string[];
  note?: string | null;
  model?: string;
};

const MODEL = process.env.FUDOSAN_VACANCY_MODEL ?? 'claude-haiku-4-5-20251001';

function buildPrompt(p: Property): string {
  const lines = [
    `建物名: ${p.name ?? '不明'}`,
    `所在地: ${[p.city, p.address].filter(Boolean).join(' ') || '不明'}`,
    `最寄駅: ${p.line ?? ''} ${p.station ?? ''}${p.walk_min ? ` 徒歩${p.walk_min}分` : ''}`,
    `築年月: ${p.built_ym ?? '不明'}`,
    `総戸数（マイソク記載）: ${p.total_units ?? '不明'}`,
  ];
  return `次の分譲マンションについて、いま賃貸募集中の部屋が何室あるかをWeb検索で調べてください。

${lines.join('\n')}

手順:
1. SUUMO・LIFULL HOME'S・アットホーム・マンションレビュー等の「建物ページ」や賃貸募集一覧を検索する
2. 建物名と所在地が一致することを確認する（似た名前の別棟・別建物を混ぜない）
3. 賃貸募集中の部屋を数える。同じ部屋が複数の業者から掲載されている場合は、階数・号室・専有面積・賃料で同一とみなして1室に数える
4. 総戸数が分かれば控える
5. 売買（売出中）の件数は数えない

出力はJSONのみ。前置きや説明文は書かない。
{"building_matched": "一致した建物名 or null", "rent_listings": 整数 or null, "total_units": 整数 or null, "confidence": "high|medium|low", "note": "数え方の根拠を1文"}

- 建物が特定できなかったら building_matched と rent_listings を null にする
- 建物は特定できたが募集が1件も見当たらないときは rent_listings を 0 にする
- confidence は、建物の一致が確実で件数も確認できたら high、建物は一致するが件数に自信がなければ medium、建物の一致自体が怪しければ low`;
}

function parseJson(text: string): Record<string, unknown> | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

const int = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null;

/**
 * 建物の賃貸募集件数を検索する。失敗しても例外は投げず、status で返す。
 * timeoutMs は ingest の maxDuration(60s) に収まるように呼び出し側で決める。
 */
export async function lookupBuildingVacancy(p: Property, timeoutMs = 35000): Promise<BuildingVacancy> {
  const checked_at = new Date().toISOString();
  if (!p.name) return { status: 'skipped', checked_at, note: '建物名が読み取れず検索しなかった' };
  if (!process.env.ANTHROPIC_API_KEY) return { status: 'error', checked_at, note: 'ANTHROPIC_API_KEY 未設定' };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        tools: [{
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 4,
          user_location: { type: 'approximate', country: 'JP', timezone: 'Asia/Tokyo' },
        }],
        messages: [{ role: 'user', content: buildPrompt(p) }],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[fudosan/vacancy] anthropic error', res.status, JSON.stringify(data).slice(0, 500));
      return { status: 'error', checked_at, model: MODEL, note: `API ${res.status}: ${data?.error?.message ?? ''}`.slice(0, 200) };
    }

    type Block = { type: string; text?: string; content?: Array<{ url?: string }> };
    const blocks: Block[] = data.content ?? [];
    const text = blocks.filter(b => b.type === 'text').map(b => b.text ?? '').join('\n');
    const sources = Array.from(new Set(
      blocks
        .filter(b => b.type === 'web_search_tool_result' && Array.isArray(b.content))
        .flatMap(b => (b.content ?? []).map(c => c.url).filter((u): u is string => !!u)),
    )).slice(0, 8);

    const j = parseJson(text);
    if (!j) {
      console.error('[fudosan/vacancy] unparsable', text.slice(0, 300));
      return { status: 'error', checked_at, model: MODEL, sources, note: '検索結果をJSONとして読めなかった' };
    }

    const rent = int(j.rent_listings);
    const matched = typeof j.building_matched === 'string' && j.building_matched ? j.building_matched : null;
    const conf = ['high', 'medium', 'low'].includes(String(j.confidence)) ? (j.confidence as 'high' | 'medium' | 'low') : 'low';
    return {
      status: matched && rent !== null ? 'ok' : 'not_found',
      checked_at,
      building_matched: matched,
      rent_listings: rent,
      total_units: int(j.total_units),
      confidence: conf,
      sources,
      note: typeof j.note === 'string' ? j.note.slice(0, 200) : null,
      model: MODEL,
    };
  } catch (e) {
    const aborted = (e as Error)?.name === 'AbortError';
    console.error('[fudosan/vacancy] failed', aborted ? 'timeout' : e);
    return { status: 'error', checked_at, model: MODEL, note: aborted ? `検索が${timeoutMs / 1000}秒で終わらなかった` : String(e).slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}
