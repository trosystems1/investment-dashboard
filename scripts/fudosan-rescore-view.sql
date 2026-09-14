-- fudosan_latest にゲート別の不合格理由を持たせる。
-- 一覧の「主な理由」が NG しか出せず、C判定の行が空欄になっていたため。
-- Supabase の SQL Editor で1回実行すればよい。

create or replace view fudosan_latest as
select
  p.*,
  e.verdict, e.score, e.criteria_version, e.metrics, e.ng_reasons,
  e.gate2_fails, e.gate3_fails, e.gate4_fails,
  e.warnings, e.todo, e.market_context, e.created_at as evaluated_at
from fudosan_properties p
left join lateral (
  select * from fudosan_evaluations ev
  where ev.property_id = p.id
  order by ev.created_at desc limit 1
) e on true;
