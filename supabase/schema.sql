-- ============================================================
-- 주식 픽 게임 스키마
-- Supabase SQL Editor에서 전체 실행
-- ============================================================

-- 1. 사용자 프로필 (Supabase Auth와 1:1 연결)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nickname    text not null,
  points      integer not null default 1000,  -- 가입 보너스
  created_at  timestamptz not null default now()
);

-- 닉네임 중복 방지
create unique index profiles_nickname_unique on public.profiles (nickname);

-- 2. 주간 라운드
create table public.weekly_rounds (
  id          uuid primary key default gen_random_uuid(),
  start_date  date not null,
  end_date    date not null,  -- 금요일 (휴일이면 목요일)
  is_finalized boolean not null default false,
  created_at  timestamptz not null default now()
);

-- 3. 라운드별 종목 (정규화)
create table public.round_stocks (
  id          uuid primary key default gen_random_uuid(),
  round_id    uuid not null references public.weekly_rounds(id) on delete cascade,
  stock_code  text not null,
  stock_name  text not null,
  sort_order  smallint not null default 0,
  -- 3단계: 분석자료 URL 추가 예정
  -- analysis_url text,
  constraint round_stocks_unique unique (round_id, stock_code)
);

-- 4. 사용자 픽
create table public.picks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  round_id      uuid not null references public.weekly_rounds(id) on delete cascade,
  stock_code    text not null,
  submitted_at  timestamptz not null default now(),
  -- 라운드당 1인 1픽 강제
  constraint picks_unique unique (user_id, round_id)
);

-- 5. 라운드 결과
create table public.results (
  id              uuid primary key default gen_random_uuid(),
  round_id        uuid not null references public.weekly_rounds(id) on delete cascade,
  rank1_stock     text not null,
  rank2_stock     text not null,
  change_rates    jsonb not null default '{}',  -- { "005930": 1.2, ... }
  finalized_at    timestamptz not null default now(),
  constraint results_round_unique unique (round_id)
);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

alter table public.profiles    enable row level security;
alter table public.weekly_rounds enable row level security;
alter table public.round_stocks  enable row level security;
alter table public.picks         enable row level security;
alter table public.results       enable row level security;

-- profiles: 본인 조회/수정만
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- weekly_rounds: 전체 읽기
create policy "rounds_select_all" on public.weekly_rounds
  for select using (true);

-- round_stocks: 전체 읽기
create policy "round_stocks_select_all" on public.round_stocks
  for select using (true);

-- picks: 본인 제출 + 조회
create policy "picks_select_own" on public.picks
  for select using (auth.uid() = user_id);

create policy "picks_insert_own" on public.picks
  for insert with check (auth.uid() = user_id);

-- results: 확정된 라운드만 읽기 (미확정 결과 노출 방지)
create policy "results_select_finalized" on public.results
  for select using (
    exists (
      select 1 from public.weekly_rounds r
      where r.id = round_id and r.is_finalized = true
    )
  );

-- ============================================================
-- 트리거: 회원가입 시 profiles 자동 생성 + 1000pt 지급
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, nickname)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nickname', 'user_' || left(new.id::text, 6))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 함수: 라운드 결과 확정 + 포인트 자동 지급
-- (관리자가 results insert 후 이 함수 호출)
-- ============================================================
create or replace function public.finalize_round(p_round_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_rank1 text;
  v_rank2 text;
begin
  -- 결과 조회
  select rank1_stock, rank2_stock
  into v_rank1, v_rank2
  from public.results
  where round_id = p_round_id;

  -- 포인트 지급: 1위 +100, 2위 +50
  update public.profiles p
  set points = points + case
    when pk.stock_code = v_rank1 then 100
    when pk.stock_code = v_rank2 then 50
    else 0
  end
  from public.picks pk
  where pk.round_id = p_round_id
    and pk.user_id = p.id
    and (pk.stock_code = v_rank1 or pk.stock_code = v_rank2);

  -- 라운드 확정 처리
  update public.weekly_rounds
  set is_finalized = true
  where id = p_round_id;
end;
$$;

-- ============================================================
-- 샘플 데이터 (개발용 — 운영 시 삭제)
-- ============================================================
do $$
declare
  v_round1 uuid := gen_random_uuid();
  v_round2 uuid := gen_random_uuid();
begin
  -- 지난 라운드 (확정)
  insert into public.weekly_rounds (id, start_date, end_date, is_finalized)
  values (v_round1, '2026-06-08', '2026-06-13', true);

  insert into public.round_stocks (round_id, stock_code, stock_name, sort_order) values
    (v_round1, '005930', '삼성전자',        1),
    (v_round1, '000660', 'SK하이닉스',      2),
    (v_round1, '035720', '카카오',          3),
    (v_round1, '035420', 'NAVER',           4),
    (v_round1, '207940', '삼성바이오로직스', 5);

  insert into public.results (round_id, rank1_stock, rank2_stock, change_rates) values
    (v_round1, '000660', '207940',
     '{"005930": 1.2, "000660": 8.4, "035720": -2.1, "035420": 3.5, "207940": 5.7}');

  -- 이번 주 라운드 (진행중)
  insert into public.weekly_rounds (id, start_date, end_date, is_finalized)
  values (v_round2, '2026-06-15', '2026-06-20', false);

  insert into public.round_stocks (round_id, stock_code, stock_name, sort_order) values
    (v_round2, '005930', '삼성전자',  1),
    (v_round2, '000660', 'SK하이닉스', 2),
    (v_round2, '035420', 'NAVER',     3),
    (v_round2, '005380', '현대차',    4),
    (v_round2, '051910', 'LG화학',    5);
end;
$$;
