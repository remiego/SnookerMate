create extension if not exists pgcrypto;

create table public.account_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create table public.player_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  player1_id uuid references public.player_profiles (id) on delete set null,
  player2_id uuid references public.player_profiles (id) on delete set null,
  player1_name text not null,
  player2_name text not null,
  player1_score integer not null default 0 check (player1_score >= 0),
  player2_score integer not null default 0 check (player2_score >= 0),
  winner_name text,
  created_at timestamptz not null default now()
);

create index player_profiles_user_id_idx on public.player_profiles (user_id);
create index matches_user_created_idx on public.matches (user_id, created_at desc);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.account_profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.create_account_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.account_profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_account_profile();

alter table public.account_profiles enable row level security;
alter table public.player_profiles enable row level security;
alter table public.matches enable row level security;

create policy "Users can read their account profile"
  on public.account_profiles for select
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "Users can update their display name"
  on public.account_profiles for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and role = 'user');
create policy "Admins can update any account profile"
  on public.account_profiles for update
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Owners and admins can read player profiles"
  on public.player_profiles for select
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Owners and admins can create player profiles"
  on public.player_profiles for insert
  with check (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Owners and admins can update player profiles"
  on public.player_profiles for update
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Owners and admins can delete player profiles"
  on public.player_profiles for delete
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Owners and admins can read matches"
  on public.matches for select
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Owners and admins can create matches"
  on public.matches for insert
  with check (
    (user_id = (select auth.uid())
      and (player1_id is null or exists (
        select 1 from public.player_profiles
        where id = player1_id and user_id = (select auth.uid())
      ))
      and (player2_id is null or exists (
        select 1 from public.player_profiles
        where id = player2_id and user_id = (select auth.uid())
      ))
    )
    or (select public.is_admin())
  );
create policy "Owners and admins can update matches"
  on public.matches for update
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (
    (user_id = (select auth.uid())
      and (player1_id is null or exists (
        select 1 from public.player_profiles
        where id = player1_id and user_id = (select auth.uid())
      ))
      and (player2_id is null or exists (
        select 1 from public.player_profiles
        where id = player2_id and user_id = (select auth.uid())
      ))
    )
    or (select public.is_admin())
  );
create policy "Owners and admins can delete matches"
  on public.matches for delete
  using (user_id = (select auth.uid()) or (select public.is_admin()));

grant execute on function public.is_admin() to authenticated;
grant select, update on public.account_profiles to authenticated;
grant select, insert, update, delete on public.player_profiles to authenticated;
grant select, insert, update, delete on public.matches to authenticated;
