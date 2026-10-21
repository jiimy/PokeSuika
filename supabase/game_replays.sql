-- 플레이 리플레이 저장
-- user_id: 로그인 유저 또는 게스트 안정 UUID (조회 키)
-- guest_id: 표시용 guest01234 (nullable)
-- auth.users FK 는 게스트 UUID 저장을 위해 사용하지 않음
create table if not exists public.game_replays (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  guest_id text,
  score integer not null default 0,
  max_grade integer,
  replay_data jsonb not null,
  duration_sec integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 기존 테이블에 auth.users FK 가 있다면 제거
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'game_replays'
      and constraint_type = 'FOREIGN KEY'
      and constraint_name like '%user_id%'
  ) then
    execute (
      select 'alter table public.game_replays drop constraint ' || quote_ident(constraint_name)
      from information_schema.table_constraints
      where table_schema = 'public'
        and table_name = 'game_replays'
        and constraint_type = 'FOREIGN KEY'
        and constraint_name like '%user_id%'
      limit 1
    );
  end if;
end $$;

alter table public.game_replays
  alter column user_id set not null;

create index if not exists game_replays_score_idx
  on public.game_replays (score desc, created_at desc);

create index if not exists game_replays_user_id_idx
  on public.game_replays (user_id);

create index if not exists game_replays_guest_id_idx
  on public.game_replays (guest_id);

alter table public.game_replays enable row level security;

-- insert 는 서버 service_role API 로 처리 (게스트 UUID 포함)

-- 조회: 누구나 (랭킹/리플레이 재생)
drop policy if exists "Anyone can view replays" on public.game_replays;
create policy "Anyone can view replays"
  on public.game_replays
  for select
  to public
  using (true);

comment on column public.game_replays.user_id is '로그인/게스트 공통 조회 키 (UUID)';
comment on column public.game_replays.guest_id is '표시용 게스트 ID (예: guest01234)';
comment on column public.game_replays.replay_data is 'version/seed/actions JSON';
