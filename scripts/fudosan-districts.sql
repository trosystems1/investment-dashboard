-- 差分SQL v2: 駅単位 → 町丁目単位に変更
-- scripts/fudosan.sql のあと、Supabase SQL Editor で実行。
--
-- 変更理由: 国交省 XIT001 のレスポンスに NearestStation が含まれていないことが
-- 実行して判明した。最小粒度は DistrictName（町丁目）。
-- マイソクには住所が載っているので、駅より町丁目のほうがマッチング精度も高い。
--
-- 既に schema.sql を実行済みの場合は、このファイルを追加で実行してください。

create extension if not exists "pgcrypto";

create table if not exists fudosan_district_scores (
  id                          uuid primary key default gen_random_uuid(),
  city                        text not null,          -- 品川区
  district                    text not null,          -- 荏原
  city_code                   text,                   -- 13109
  district_code               text,
  calculated_for              date not null,

  -- 全マンション（ファミリー含む）
  unit_price_sqm_man          numeric,                -- 万円/㎡ 中央値
  unit_price_trend_3y         numeric,                -- %
  trade_count                 integer,

  -- 20〜40㎡帯（区分ワンルーム〜コンパクト）。判定にはこちらを使う
  unit_price_sqm_man_compact  numeric,
  unit_price_trend_3y_compact numeric,
  compact_count               integer,

  avg_area_sqm                numeric,
  avg_built_year              integer,
  zoning_top                  text,                   -- 最頻の用途地域
  detail                      jsonb not null default '{}'::jsonb,
  updated_at                  timestamptz not null default now(),

  unique (city, district, calculated_for)
);

create index if not exists idx_fds_lookup on fudosan_district_scores (city, district, calculated_for desc);
create index if not exists idx_fds_city on fudosan_district_scores (city, calculated_for desc);

alter table fudosan_district_scores enable row level security;

-- 最新スナップショットだけを見るビュー
create or replace view fudosan_district_latest as
select distinct on (city, district) *
from fudosan_district_scores
order by city, district, calculated_for desc;

-- 駅ベースのテーブルは残しておいてよい（将来 ODPT の乗降客数などを入れる器）
-- 使わないなら drop table fudosan_station_scores;
