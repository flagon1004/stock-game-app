-- 종목별 픽 카운트 집계 함수 (RLS 우회, 익명 집계만 반환)
create or replace function public.get_pick_counts(p_round_id uuid)
returns table(stock_code text, cnt bigint)
language sql
security definer
set search_path = ''
as $$
  select stock_code, count(*) as cnt
  from public.picks
  where round_id = p_round_id
  group by stock_code;
$$;
