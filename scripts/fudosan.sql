-- 不動産投資（城南・区分マンション）スキーマ
-- Supabase SQL Editor にそのまま貼って実行してください。
-- 続けて scripts/fudosan-districts.sql も実行すること。
-- 旧 schema を実行済みなら scripts/fudosan-trades-drop-unique.sql も実行。

create extension if not exists "pgcrypto";

-- ============================================================
-- 1. 物件（マイソクから抽出した生データ）
-- ============================================================
create table if not exists fudosan_properties (
  id                  uuid primary key default gen_random_uuid(),
  source              text not null,                 -- google_drive / email / manual
  source_ref          text,                          -- Drive fileId など
  file_name           text,
  drive_link          text,
  dedupe_key          text unique,                   -- 物件名+価格+面積 のハッシュ。重複防止

  name                text,
  price_man           numeric,
  rent_man            numeric,
  area_sqm            numeric,
  area_basis          text,                          -- 壁芯 / 内法
  registered_sqm      numeric,
  floor_plan          text,
  management_fee_yen  numeric,
  repair_reserve_yen  numeric,
  other_monthly_yen   numeric,
  built_ym            text,
  structure           text,

  address             text,
  city                text,
  town                text,
  line                text,
  station             text,
  walk_min            integer,
  lat                 numeric,
  lon                 numeric,

  floor               integer,
  total_floors        integer,
  total_units         integer,
  facing              text,
  zoning              text,
  land_right          text,
  management_type     text,
  manager_type        text,
  occupancy           text,
  sublease            boolean,
  repair_method       text,
  property_no         text,
  agency              text,

  raw_text            text,
  raw_json            jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_fp_city on fudosan_properties (city);
create index if not exists idx_fp_station on fudosan_properties (station);
create index if not exists idx_fp_created on fudosan_properties (created_at desc);

-- ============================================================
-- 2. 評価（クライテリアのバージョンごとに履歴を残す）
-- ============================================================
create table if not exists fudosan_evaluations (
  id                uuid primary key default gen_random_uuid(),
  property_id       uuid not null references fudosan_properties(id) on delete cascade,
  criteria_version  text not null,
  verdict           text not null,                   -- A / B / C / NG / PENDING
  score             integer,
  metrics           jsonb not null default '{}'::jsonb,
  ng_reasons        jsonb not null default '[]'::jsonb,
  gate2_fails       jsonb not null default '[]'::jsonb,
  gate3_fails       jsonb not null default '[]'::jsonb,
  gate4_fails       jsonb not null default '[]'::jsonb,
  warnings          jsonb not null default '[]'::jsonb,
  bonuses           jsonb not null default '[]'::jsonb,
  todo              jsonb not null default '[]'::jsonb,
  market_context    jsonb not null default '{}'::jsonb,  -- 相場との乖離
  created_at        timestamptz not null default now()
);
create index if not exists idx_fe_prop on fudosan_evaluations (property_id, created_at desc);
create index if not exists idx_fe_verdict on fudosan_evaluations (verdict, score desc);

-- ============================================================
-- 3. 意思決定ログ（PDCAのCheckの材料。ここが最重要）
-- ============================================================
create table if not exists fudosan_decisions (
  id                uuid primary key default gen_random_uuid(),
  property_id       uuid not null references fudosan_properties(id) on delete cascade,
  action            text not null,   -- 通知 / 資料請求 / 内見 / 買付 / 見送り / 購入
  reason_tag        text,            -- 融資不可 / 管理組合 / 賃料相場割れ / 立地 / 価格 / その他
  subjective_score  integer,         -- 内見後の主観評価 1-5
  memo              text,
  decided_at        timestamptz not null default now()
);
create index if not exists idx_fd_prop on fudosan_decisions (property_id, decided_at desc);

-- ============================================================
-- 4. 成約価格の蓄積（国交省 不動産情報ライブラリ XIT001）
--    「過去のデータとして場所・地価トレンドを分析に使う」の中核
-- ============================================================
create table if not exists fudosan_trades (
  id                uuid primary key default gen_random_uuid(),
  prefecture_code   text not null,
  city_code         text not null,
  city_name         text,
  district_name     text,            -- 地区名（町丁目）
  station_name      text,
  trade_type        text,            -- 中古マンション等
  period_year       integer not null,
  period_quarter    integer not null,
  trade_price       numeric,         -- 円
  unit_price_sqm    numeric,         -- 円/㎡（計算値）
  area_sqm          numeric,
  floor_plan        text,
  building_year     text,
  structure         text,
  raw               jsonb,
  fetched_at        timestamptz not null default now()
  -- unique は付けない。国交省は価格・面積を丸めて公表するため、
  -- 同じ町丁目・四半期・価格・面積の取引が複数あるのは正常。
  -- 冪等性は (市区 × 年 × 四半期) の delete → insert で担保する。
);
create index if not exists idx_ft_city_period on fudosan_trades (city_code, period_year desc, period_quarter desc);
create index if not exists idx_ft_station on fudosan_trades (station_name);

-- ============================================================
-- 5. 地価公示・地価調査（XCT001 / XPT002）
-- ============================================================
create table if not exists fudosan_land_prices (
  id                uuid primary key default gen_random_uuid(),
  year              integer not null,
  city_code         text not null,
  city_name         text,
  address           text,
  use_category      text,            -- 住宅地 / 商業地
  price_per_sqm     numeric,         -- 円/㎡
  change_rate       numeric,         -- 前年比 %
  nearest_station   text,
  walk_min          integer,
  lat               numeric,
  lon               numeric,
  raw               jsonb,
  fetched_at        timestamptz not null default now(),
  unique (year, city_code, address, use_category)
);
create index if not exists idx_flp_city_year on fudosan_land_prices (city_code, year desc);

-- ============================================================
-- 6. 駅スコア（月次バッチで再計算）
-- ============================================================
create table if not exists fudosan_station_scores (
  id                  uuid primary key default gen_random_uuid(),
  station             text not null,
  line                text,
  city                text,
  calculated_for      date not null,
  score               numeric,
  rent_per_sqm        numeric,        -- 円/㎡・月（自前蓄積＋校正）
  rent_1k_man         numeric,
  unit_price_sqm_man  numeric,        -- 成約㎡単価（万円）
  unit_price_trend_3y numeric,        -- 3年トレンド %
  trade_count         integer,        -- 流動性の代理指標
  land_price_trend_3y numeric,
  passengers          integer,        -- 乗降客数
  single_households   integer,
  flood_depth_max     numeric,
  tier                text,           -- priority / normal / exclude
  detail              jsonb not null default '{}'::jsonb,
  updated_at          timestamptz not null default now(),
  unique (station, line, calculated_for)
);
create index if not exists idx_fss_station on fudosan_station_scores (station, calculated_for desc);

-- ============================================================
-- 7. 月次KPI（PDCAのCheck）
-- ============================================================
create table if not exists fudosan_kpi_monthly (
  id              uuid primary key default gen_random_uuid(),
  month           date not null unique,
  inflow          integer default 0,   -- 流入件数
  passed_gate1    integer default 0,   -- ハードNGを通過
  verdict_a       integer default 0,
  verdict_b       integer default 0,
  verdict_c       integer default 0,
  verdict_ng      integer default 0,
  doc_requested   integer default 0,
  viewed          integer default 0,   -- 内見
  offered         integer default 0,   -- 買付
  purchased       integer default 0,
  criteria_version text,
  note            text,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- 便利ビュー: 最新評価つき物件一覧
-- ============================================================
create or replace view fudosan_latest as
select
  p.*,
  e.verdict, e.score, e.criteria_version, e.metrics, e.ng_reasons,
  e.warnings, e.todo, e.market_context, e.created_at as evaluated_at
from fudosan_properties p
left join lateral (
  select * from fudosan_evaluations ev
  where ev.property_id = p.id
  order by ev.created_at desc limit 1
) e on true;

-- ============================================================
-- RLS（service_role からのみ書き込み。読み取りは匿名不可）
-- ============================================================
alter table fudosan_properties      enable row level security;
alter table fudosan_evaluations     enable row level security;
alter table fudosan_decisions       enable row level security;
alter table fudosan_trades          enable row level security;
alter table fudosan_land_prices     enable row level security;
alter table fudosan_station_scores  enable row level security;
alter table fudosan_kpi_monthly     enable row level security;
