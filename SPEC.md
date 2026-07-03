# APEX Investment Dashboard 仕様書

## プロジェクト概要
- **名称**: APEX Investment Dashboard
- **URL**: https://investment-dashboard-ruby.vercel.app
- **用途**: 個人資産管理・日本株投資分析ダッシュボード
- **リポジトリ**: https://github.com/trosystems1/investment-dashboard

## 技術スタック
- **フレームワーク**: Next.js 14 (App Router) / TypeScript
- **スタイリング**: Tailwind CSS + インラインスタイル
- **チャート**: Recharts
- **デプロイ**: Vercel (trosystems1s-projects)
- **DB/キャッシュ**: Upstash Redis
- **データソース**: J-Quants API v2 (Lightプラン)
- **フォント**: Inter + Noto Sans JP (Google Fonts)

## 認証・環境変数
| 変数名 | 用途 | 環境 |
|---|---|---|
| `JQUANTS_API_KEY` | J-Quants API認証 (x-api-keyヘッダー) | Production only |
| `KV_REST_API_URL` | Upstash Redis URL | Production |
| `KV_REST_API_TOKEN` | Upstash Redis Token | Production |
| `CRON_SECRET` | Cronジョブ認証（現在: apex2026） | Production |

## J-Quants API 重要事項
- 認証: `x-api-key` ヘッダー（Bearer不要）
- 銘柄コード: 5桁（末尾に0追加、例: `228A` → `228A0`）
- `CurPerType`: `FY`=通期、`3Q`=四半期
- 予想フィールドはFプレフィックス（`FEPS`, `FSales`, `FNP`）
- `equities/master` のフィールド名: `Mkt`（市場コード）、`CoName`（会社名）、`S33Nm`（業種名）
- プライム市場コード: `0111`
- `fins/summary` は `from`/`to` で期間指定（YYYY-MM-DD形式）

## 画面構成

### トップページ (`/`)
- KPIカード（総資産・損益・ウォッチリスト平均・シャープレシオ）
- TOPIXチャート（ローソク足、1M/3M/6M/1Y切替）
- 投資部門別売買動向チャート
  - 市場フィルタ: 全体/プライム/スタンダード/グロース
  - 投資家フィルタ: 全投資家/海外/個人/投信/信託銀行/事業法人/生保損保
  - 表示モード: 差引/買い/売り
- 保有株リスト（4銘柄）
- ウォッチリスト（6銘柄）
- NenkinRanking・PerRankingコンポーネント（横並び）

### 銘柄詳細ページ (`/stock/[ticker]`)
- 株価チャート
- 財務サマリー（予想PER等）

### スクリーナーページ (`/screener`)
- プライム全銘柄（約1,564社）
- フィルタ: PBR上限・ROE下限・配当利回り下限・時価総額下限・銘柄名/コード検索
- ソート: 各指標でソート可能
- 表示指標: コード・銘柄名・業種・株価・時価総額・PBR・PER・予想PER・ROE・配当利回り・営業利益率

## Redisキー一覧
| キー | 内容 | TTL |
|---|---|---|
| `stock:{code}.T` | 個別株価データ | 86400秒 |
| `screener:prime` | プライム全銘柄スクリーナーデータ | 172800秒 |

## Cronジョブ
| パス | スケジュール | 用途 |
|---|---|---|
| `/api/cron` | 平日8時(UTC) | ウォッチリスト10銘柄の株価更新 |
| `/api/cron/screener` | 平日18時(UTC) | プライム全銘柄データ更新（日本時間翌3時） |
| `/api/cron/nikkei-morning-summary` | 毎日22時(UTC、日本時間7時) | 日経225オプション朝サマリー生成・Supabase保存 |
| `/api/cron/aria-daily` | 毎日22時(UTC、日本時間7時) | ARIA向け「月次比較・日米連動」インサイト生成・Supabase保存 |

## ARIA向けインサイトAPI (`/api/insights/aria-daily`)
- ARIA(YouTube米国市況動画の自動生成パイプライン)向けに、S&P500/NASDAQの1ヶ月・3ヶ月騰落率、セクターETF別の1ヶ月騰落率、米国株の当日の値動きと翌営業日の日経225の反応の突き合わせ（相関係数・同方向判定）を計算する
- 生成ロジックは `lib/aria-daily.ts`、Supabaseテーブルは `aria_daily_insights`（スキーマ: `scripts/aria-daily-insights.sql`）
- 相関・連動判定は単純な手法であり、統計的な因果関係を主張するものではない
- レスポンスは `facts: string[]`（日本語の短文配列、ナレーション素材向け）を含む

## ウォッチリスト銘柄
`228A`, `4397`, `4374`, `431A`, `4443`, `4478`, `3994`, `4776`, `4058`, `4811`

## 既知の問題・注意点
- J-Quantsレート制限: 429エラーが発生することがある → リトライ処理で対応予定
- Vercel Hobbyの10秒制限: 1,564銘柄の株価一括取得はタイムアウトの可能性あり
- CRON_SECRETはSensitiveのため値の確認不可（現在: apex2026）

## 今後の開発予定
- [ ] スクリーナーCronのリトライ処理追加
- [ ] MSCI Japan構成銘柄フィルタ
- [ ] スコアリング機能（PBR×ROE×モメンタム）
- [ ] 自動売買シグナル機能
