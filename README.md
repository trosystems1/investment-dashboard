# APEX Investment Dashboard

ダーク×ゴールドのラグジュアリー投資ダッシュボード。
Yahoo Finance APIからリアルタイムデータを取得します。

## セットアップ

```bash
# 依存パッケージをインストール（初回のみ）
npm install

# 開発サーバーを起動
npm run dev
```

ブラウザで http://localhost:3000 にアクセス。

## 機能

- リアルタイム株価 — Yahoo Finance API経由、60秒ごと自動更新
- チャート切替 — 日経平均 / S&P500 / USD-JPY / Gold / BTC など
- 期間切替 — 1M / 3M / 6M / 1Y
- ウォッチリスト — トヨタ・ソニー・三菱UFJ・Apple・NVDA・Microsoft

## ウォッチリストのカスタマイズ

`app/page.tsx` の WATCHLIST 配列を編集してください。

  const WATCHLIST = ['7203.T', '6758.T', '8306.T', 'AAPL', 'NVDA', 'MSFT']
  // .T = 東京証券取引所の銘柄コード

## 技術スタック

- Next.js 14 (App Router)
- React 18
- Recharts（チャートライブラリ）
- Tailwind CSS
- Yahoo Finance API（非公式・無料）
