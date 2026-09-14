-- fudosan_latest にゲート別の不合格理由を持たせる。
-- 一覧の「主な理由」が NG しか出せず、C判定の行が空欄になっていたため。
--
-- 注意: create or replace view は列を末尾にしか追加できない。
-- 既存の列の間に差し込むと 42P16 (cannot change name of view column) で落ちる。
-- そのため gate2/3/4_fails は select の最後に置いている。順序はアプリに影響しない
-- （PostgREST は列名で取得するため）。

create or replace view fudosan_latest as
select
  p.*,
  e.verdict, e.score, e.criteria_version, e.metrics, e.ng_reasons,
  e.warnings, e.todo, e.market_context, e.created_at as evaluated_at,
  e.gate2_fails, e.gate3_fails, e.gate4_fails
from fudosan_properties p
left join lateral (
  select * from fudosan_evaluations ev
  where ev.property_id = p.id
  order by ev.created_at desc limit 1
) e on true;
