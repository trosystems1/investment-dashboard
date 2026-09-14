-- aria_daily_insights テーブルに個別株・決算カラムを追加
-- Supabase SQL Editor で1回実行してください

alter table aria_daily_insights
  add column if not exists stock_quotes jsonb,   -- トップ50個別株の前日比
  add column if not exists earnings     jsonb;   -- 当日の決算カレンダー（トップ50フィルター済み）
