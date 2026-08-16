-- fudosan.sql を既に実行済みの場合のみ。未実行なら不要。
-- 国交省 XIT001 は価格・面積を丸めるため、行単位 unique だと本物の成約を落とす。

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'fudosan_trades'::regclass
    and contype = 'u';
  if cname is not null then
    execute format('alter table fudosan_trades drop constraint %I', cname);
  end if;
end $$;
