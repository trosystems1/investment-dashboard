-- 1K（小規模住戸）の賃料相場。
-- scripts/fudosan.sql のあと、Supabase SQL Editor に貼って実行する。
-- 再実行してよい（市区の4行は上書きする。町名・駅圏の行は触らない）。
-- すでにこのテーブルがある環境でも、下の ALTER で列を足してから upsert する。
--
-- 出典: 総務省 令和5年住宅・土地統計調査 基本集計 第130表
--   Excel statInfId=000040210078（2024-09-25公表）
--   更新cronが叩く DB API は表130-2 statsDataId=0004021532（同じ平均）
-- セル: 民営借家（専用住宅）× 共同住宅（非木造）× 延べ面積29㎡以下 × 家賃0円を含まない
--
-- rent_1k_yen / rent_1k_man は 2023-10-01 の在庫平均（入居中契約）。
-- rent_asking_yen / rent_asking_man は、その時点の係数で掛けた募集相当のスナップショット。
-- 判定は DB の asking をそのまま使わず、criteria.ts の CONFIG.rent で在庫円に掛け直す。
-- 係数を変えたあとは再スコアだけで判定が変わる。このファイルの再実行はスナップショットを揃える。
--
-- 調査の最小単位は区。町名（level=town）と駅圏（level=area）の行を足すと、
-- 判定は 町名 → 駅圏 → 区 の順で引く。
--   district は fudosan_geo_stats / fudosan_area_of と同じ文字列（区の行は空文字）。
-- 町名・駅圏に「観測した募集賃料」を入れるときは rent_basis='asking' にする。
-- 'stock' のままだと在庫平均とみなして、もう一度係数を掛ける。
--
-- 注意: cron（ESTAT_APP_ID）が区の円額を更新したあとに、下の INSERT を
-- 再実行すると、このファイルに書いてある円額で戻る。

create extension if not exists "pgcrypto";

create table if not exists fudosan_rent_market (
  id                 uuid primary key default gen_random_uuid(),
  level              text not null check (level in ('town', 'area', 'city')),
  city               text not null,
  district           text not null default '',
  rent_1k_yen        integer,
  rent_1k_man        numeric not null,
  rent_asking_yen    integer,
  rent_asking_man    numeric,
  correction_factor  numeric,
  correction_as_of   date,
  correction_note    text,
  rent_basis         text not null default 'stock' check (rent_basis in ('stock', 'asking')),
  sample_n           integer,
  source             text not null,
  as_of              date not null,
  published_at       date,
  segment            text,
  stats_id           text,
  note               text,
  updated_at         timestamptz not null default now(),
  unique (level, city, district)
);

alter table fudosan_rent_market add column if not exists rent_asking_yen integer;
alter table fudosan_rent_market add column if not exists rent_asking_man numeric;
alter table fudosan_rent_market add column if not exists correction_factor numeric;
alter table fudosan_rent_market add column if not exists correction_as_of date;
alter table fudosan_rent_market add column if not exists correction_note text;
alter table fudosan_rent_market add column if not exists rent_basis text;

update fudosan_rent_market set rent_basis = 'stock' where rent_basis is null;
alter table fudosan_rent_market alter column rent_basis set default 'stock';

do $$
begin
  alter table fudosan_rent_market
    add constraint fudosan_rent_market_rent_basis_chk
    check (rent_basis in ('stock', 'asking'));
exception
  when duplicate_object then null;
end $$;

create index if not exists idx_frm_lookup on fudosan_rent_market (city, level, district);

alter table fudosan_rent_market enable row level security;

insert into fudosan_rent_market (
  level, city, district, rent_1k_yen, rent_1k_man,
  rent_asking_yen, rent_asking_man, correction_factor, correction_as_of, correction_note, rent_basis,
  sample_n, source, as_of, published_at, segment, stats_id, note
) values
  (
    'city', '品川区', '', 81353, 8.14,
    120660, 12.07, 1.4831712, '2026-09-01',
    '在庫平均×新規契約比1.008（第111-1表）×CPI1.051（民営家賃・非木造 2026-09/2023-10）×募集構成1.40',
    'stock',
    49650,
    'e-Stat 令和5年住宅・土地統計調査 基本集計 第130表',
    '2023-10-01', '2024-09-25',
    '民営借家（専用住宅）・共同住宅（非木造）・延べ面積29㎡以下・家賃0円を含まない平均',
    '0004021532',
    'rent_1k_* は在庫平均。rent_asking_* は係数適用後のスナップショット。判定は在庫円に現行係数を掛け直す。'
  ),
  (
    'city', '目黒区', '', 85375, 8.54,
    126626, 12.66, 1.4831712, '2026-09-01',
    '在庫平均×新規契約比1.008（第111-1表）×CPI1.051（民営家賃・非木造 2026-09/2023-10）×募集構成1.40',
    'stock',
    24540,
    'e-Stat 令和5年住宅・土地統計調査 基本集計 第130表',
    '2023-10-01', '2024-09-25',
    '民営借家（専用住宅）・共同住宅（非木造）・延べ面積29㎡以下・家賃0円を含まない平均',
    '0004021532',
    'rent_1k_* は在庫平均。rent_asking_* は係数適用後のスナップショット。判定は在庫円に現行係数を掛け直す。'
  ),
  (
    'city', '大田区', '', 71628, 7.16,
    106237, 10.62, 1.4831712, '2026-09-01',
    '在庫平均×新規契約比1.008（第111-1表）×CPI1.051（民営家賃・非木造 2026-09/2023-10）×募集構成1.40',
    'stock',
    73140,
    'e-Stat 令和5年住宅・土地統計調査 基本集計 第130表',
    '2023-10-01', '2024-09-25',
    '民営借家（専用住宅）・共同住宅（非木造）・延べ面積29㎡以下・家賃0円を含まない平均',
    '0004021532',
    'rent_1k_* は在庫平均。rent_asking_* は係数適用後のスナップショット。判定は在庫円に現行係数を掛け直す。'
  ),
  (
    'city', '世田谷区', '', 75381, 7.54,
    111803, 11.18, 1.4831712, '2026-09-01',
    '在庫平均×新規契約比1.008（第111-1表）×CPI1.051（民営家賃・非木造 2026-09/2023-10）×募集構成1.40',
    'stock',
    75070,
    'e-Stat 令和5年住宅・土地統計調査 基本集計 第130表',
    '2023-10-01', '2024-09-25',
    '民営借家（専用住宅）・共同住宅（非木造）・延べ面積29㎡以下・家賃0円を含まない平均',
    '0004021532',
    'rent_1k_* は在庫平均。rent_asking_* は係数適用後のスナップショット。判定は在庫円に現行係数を掛け直す。'
  )
on conflict (level, city, district) do update set
  rent_1k_yen = excluded.rent_1k_yen,
  rent_1k_man = excluded.rent_1k_man,
  rent_asking_yen = excluded.rent_asking_yen,
  rent_asking_man = excluded.rent_asking_man,
  correction_factor = excluded.correction_factor,
  correction_as_of = excluded.correction_as_of,
  correction_note = excluded.correction_note,
  rent_basis = excluded.rent_basis,
  sample_n = excluded.sample_n,
  source = excluded.source,
  as_of = excluded.as_of,
  published_at = excluded.published_at,
  segment = excluded.segment,
  stats_id = excluded.stats_id,
  note = excluded.note,
  updated_at = now();
