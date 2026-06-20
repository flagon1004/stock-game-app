-- ============================================================
-- 관리자 설정 SQL
-- Supabase SQL Editor에서 실행
-- ============================================================

-- 1. profiles 테이블에 is_admin 컬럼 추가
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- 2. 관리자 RLS 정책 추가
-- weekly_rounds: 관리자만 insert/update
create policy "rounds_insert_admin" on public.weekly_rounds
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "rounds_update_admin" on public.weekly_rounds
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- round_stocks: 관리자만 insert/delete
create policy "round_stocks_insert_admin" on public.round_stocks
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "round_stocks_delete_admin" on public.round_stocks
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- results: 관리자만 insert
create policy "results_insert_admin" on public.results
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- profiles: 관리자는 모든 프로필 조회 가능
create policy "profiles_select_admin" on public.profiles
  for select using (
    auth.uid() = id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- 3. finalize_round 함수는 이미 security definer이므로 관리자 체크는 앱에서 처리

-- ============================================================
-- 관리자 계정 지정 (닉네임으로 찾아서 is_admin = true 설정)
-- 아래 'admin닉네임' 부분을 실제 관리자 닉네임으로 변경 후 실행
-- ============================================================
update public.profiles set is_admin = true where nickname = '신들린영혼';
