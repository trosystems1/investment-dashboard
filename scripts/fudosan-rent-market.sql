-- 1K（小規模住戸）の賃料相場。
-- scripts/fudosan.sql のあと、Supabase SQL Editor に貼って実行する。
-- 再実行してよい（市区の4行は上書きする。町名・駅圏の行は触らない）。
--
-- 出典: 総務省 令和5年住宅・土地統計調査 基本集計 第130表
--   Excel statInfId=000040210078（2024-09-25公表）
--   更新cronが叩く DB API は表130-2 statsDataId=0004021532（同じ平均）
-- セル: 民営借家（専用住宅）× 共同住宅（非木造）× 延べ面積29㎡以下 × 家賃0円を含まない
--
-- これは2023年10月1日時点の「入居中契約の平均」で、募集賃料ではない。
-- 調査の最小単位は区。町名（level=town）と駅圏（level=area）の行を足すと、
-- 判定は 町名 → 駅圏 → 区 の順で引く。
--   district は fudosan_geo_stats / fudosan_area_of と同じ文字列（区の行は空文字）。
-- 町名・駅圏の行は source を変えて INSERT する。このファイルの再実行では消えない。
--
-- 注意: cron（ESTAT_APP_ID）が区の円額を更新したあとに、下の INSERT を
-- 再実行すると、このファイルに書いてある円額で戻る。

create extension if not exists "pgcrypto";

create table if not exists fudosan_rent_market (
  id            uuid primary key default gen_random_uuid(),
  level         text not null check (level in ('town', 'area', 'city')),
  city          text not null,
  district      text not null default '',
  rent_1k_yen   integer,
  rent_1k_man   numeric not null,
  sample_n      integer,
  source        text not null,
  as_of         date not null,
  published_at  date,
  segment       text,
  stats_id      text,
  note          text,
  updated_at    timestamptz not null default now(),
  unique (level, city, district)
);

create index if not exists idx_frm_lookup on fudosan_rent_market (city, level, district);

alter table fudosan_rent_market enable row level security;

insert into fudosan_rent_market (
  level, city, district, rent_1k_yen, rent_1k_man, sample_n,
  source, as_of, published_at, segment, stats_id, note
) values
  (
    'city', '品川区', '', 81353, 8.14, 49650,
    'e-Stat 令和5年住宅・土地統計調査 基本集計 第130表',
    '2023-10-01', '2024-09-25',
    '民営借家（専用住宅）・共同住宅（非木造）・延べ面積29㎡以下・家賃0円を含まない平均',
    '0004021532',
    '抽出調査の在庫平均。募集賃料ではない。戸数は表章値。'
  ),
  (
    'city', '目黒区', '', 85375, 8.54, 24540,
    'e-Stat 令和5年住宅・土地統計調査 基本集計 第130表',
    '2023-10-01', '2024-09-25',
    '民営借家（専用住宅）・共同住宅（非木造）・延べ面積29㎡以下・家賃0円を含まない平均',
    '0004021532',
    '抽出調査の在庫平均。募集賃料ではない。戸数は表章値。'
  ),
  (
    'city', '大田区', '', 71628, 7.16, 73140,
    'e-Stat 令和5年住宅・土地統計調査 基本集計 第130表',
    '2023-10-01', '2024-09-25',
    '民営借家（専用住宅）・共同住宅（非木造）・延べ面積29㎡以下・家賃0円を含まない平均',
    '0004021532',
    '抽出調査の在庫平均。募集賃料ではない。戸数は表章値。'
  ),
  (
    'city', '世田谷区', '', 75381, 7.54, 75070,
    'e-Stat 令和5年住宅・土地統計調査 基本集計 第130表',
    '2023-10-01', '2024-09-25',
    '民営借家（専用住宅）・共同住宅（非木造）・延べ面積29㎡以下・家賃0円を含まない平均',
    '0004021532',
    '抽出調査の在庫平均。募集賃料ではない。戸数は表章値。'
  )
on conflict (level, city, district) do update set
  rent_1k_yen = excluded.rent_1k_yen,
  rent_1k_man = excluded.rent_1k_man,
  sample_n = excluded.sample_n,
  source = excluded.source,
  as_of = excluded.as_of,
  published_at = excluded.published_at,
  segment = excluded.segment,
  stats_id = excluded.stats_id,
  note = excluded.note,
  updated_at = now();
