-- =============================================================================
-- Typing Bible Community — Postgres schema for Supabase
-- Applied automatically by `supabase start` / `supabase db reset` (local) and
-- `supabase db push` (hosted). It is idempotent enough to re-run during development.
-- =============================================================================

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles : one row per auth user. Mirrors auth.users with app fields.
--   role          : 'member' | 'minister' | 'admin'
--   is_minister   : convenience flag, true once an application is approved
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Friend',
  locale       text not null default 'en' check (locale in ('en', 'ko')),
  role         text not null default 'member' check (role in ('member', 'minister', 'admin')),
  is_minister  boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- minister_applications : request to be verified as a minister (host studies)
-- ---------------------------------------------------------------------------
create table if not exists public.minister_applications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  church_name    text not null,
  denomination   text,
  role_title     text,
  credential_url text,
  note           text,
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by    uuid references public.profiles (id),
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- reading_progress : which verses of a chapter a user has typed.
--   Progress is shared by every translation: verses are matched by number, so a
--   verse typed in one version or language counts in all of them. One row per
--   (user, book, chapter); written through record_typed_verses() below. Book
--   completion is derived in the app by checking all chapters of a book.
-- ---------------------------------------------------------------------------
create table if not exists public.reading_progress (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  book_id             smallint not null,        -- 1..66 (see src/lib/bible/books.ts)
  chapter             smallint not null,
  typed_verses        smallint[] not null default '{}',  -- verse numbers, ascending
  verses_typed        integer generated always as (cardinality(typed_verses)) stored,
  completed           boolean not null default false,    -- every verse typed, in some translation
  updated_at          timestamptz not null default now(),
  unique (user_id, book_id, chapter)
);

-- ---------------------------------------------------------------------------
-- studies : a bible study group. Only verified ministers may create one.
-- ---------------------------------------------------------------------------
create table if not exists public.studies (
  id           uuid primary key default gen_random_uuid(),
  host_id      uuid not null references public.profiles (id) on delete cascade,
  title        text not null,
  description  text,
  translation  text not null default 'web',
  schedule     text,                       -- free text, e.g. "Wed 7pm"
  is_public    boolean not null default true,
  join_code    text unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  created_at   timestamptz not null default now()
);

create table if not exists public.study_members (
  study_id   uuid not null references public.studies (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       text not null default 'member' check (role in ('host', 'member')),
  joined_at  timestamptz not null default now(),
  primary key (study_id, user_id)
);

-- ---------------------------------------------------------------------------
-- community : simple notice/discussion board (커뮤니티)
-- ---------------------------------------------------------------------------
create table if not exists public.community_posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles (id) on delete cascade,
  category   text not null default 'general' check (category in ('notice', 'qna', 'testimony', 'general')),
  title      text not null,
  body       text not null default '',
  created_at timestamptz not null default now()
);

-- =============================================================================
-- Helper functions / triggers
-- =============================================================================

-- Auto-create a profile when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- When a minister application is approved, flip the profile flag + role.
create or replace function public.sync_minister_status()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    update public.profiles
       set is_minister = true,
           role = case when role = 'admin' then 'admin' else 'minister' end
     where id = new.user_id;
    new.reviewed_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists on_minister_decision on public.minister_applications;
create trigger on_minister_decision
  before update on public.minister_applications
  for each row execute function public.sync_minister_status();

-- Auto-add the host as a study member with role 'host'.
create or replace function public.add_host_as_member()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.study_members (study_id, user_id, role)
  values (new.id, new.host_id, 'host')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_study_created on public.studies;
create trigger on_study_created
  after insert on public.studies
  for each row execute function public.add_host_as_member();

-- Is the current user a member of the study? Used by the studies read policy.
-- SECURITY DEFINER reads study_members without its RLS: that policy looks up
-- studies, so querying it from the studies policy recurses forever.
-- Lives in `private` so the Data API does not expose it as an RPC endpoint.
create schema if not exists private;

create or replace function private.is_study_member(p_study_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.study_members m
    where m.study_id = p_study_id and m.user_id = auth.uid()
  );
$$;

-- Add typed verses to the current user's progress for a chapter. The union happens
-- in one statement, so saves from several tabs or devices never overwrite each
-- other. p_chapter_verses lists the verse numbers of the translation being typed;
-- the chapter is complete once they are all typed. Runs as the caller, under RLS.
create or replace function public.record_typed_verses(
  p_book_id        smallint,
  p_chapter        smallint,
  p_verses         smallint[],
  p_chapter_verses smallint[]
)
returns public.reading_progress
language sql
set search_path = public
as $$
  insert into public.reading_progress as rp (user_id, book_id, chapter, typed_verses, completed)
  values (
    auth.uid(), p_book_id, p_chapter,
    array(select distinct v from unnest(p_verses) as v order by v),
    p_verses @> p_chapter_verses
  )
  on conflict (user_id, book_id, chapter) do update
    set typed_verses = array(select distinct v from unnest(rp.typed_verses || p_verses) as v order by v),
        completed    = rp.completed or (rp.typed_verses || p_verses) @> p_chapter_verses,
        updated_at   = now()
  returning *;
$$;

-- =============================================================================
-- Leaderboard : total verses typed per user (the "통독순위" ranking).
-- =============================================================================
create or replace view public.leaderboard as
  select
    p.id,
    p.display_name,
    p.is_minister,
    coalesce(sum(rp.verses_typed), 0)::bigint                      as verses_typed,
    coalesce(count(*) filter (where rp.completed), 0)::bigint      as chapters_completed
  from public.profiles p
  left join public.reading_progress rp on rp.user_id = p.id
  group by p.id, p.display_name, p.is_minister;

grant select on public.leaderboard to authenticated, anon;

-- =============================================================================
-- Data API privileges
-- Supabase no longer grants new public tables to the API roles automatically,
-- so grant exactly the commands the RLS policies below allow. RLS then decides
-- which rows each command may touch.
-- =============================================================================
grant select, update                 on public.profiles              to authenticated;
grant select, insert, update         on public.minister_applications to authenticated;
grant select, insert, update, delete on public.reading_progress      to authenticated;
grant select, insert, update, delete on public.studies               to authenticated;
grant select, insert, delete         on public.study_members         to authenticated;
grant select, insert, update, delete on public.community_posts       to authenticated;

-- Policies run as the querying role, so it needs the helper they call.
grant usage on schema private to authenticated;
grant execute on function private.is_study_member(uuid) to authenticated;

revoke execute on function public.record_typed_verses(smallint, smallint, smallint[], smallint[]) from public;
grant execute on function public.record_typed_verses(smallint, smallint, smallint[], smallint[]) to authenticated;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles              enable row level security;
alter table public.minister_applications enable row level security;
alter table public.reading_progress      enable row level security;
alter table public.studies               enable row level security;
alter table public.study_members         enable row level security;
alter table public.community_posts       enable row level security;

-- profiles: anyone authenticated can read (for leaderboards/member lists);
-- only the owner can update their own row.
drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles update" on public.profiles;
create policy "profiles read"   on public.profiles for select to authenticated using (true);
create policy "profiles update" on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- minister_applications: a user manages their own; admins can read all.
drop policy if exists "minapp read"   on public.minister_applications;
drop policy if exists "minapp insert" on public.minister_applications;
drop policy if exists "minapp admin"  on public.minister_applications;
create policy "minapp read" on public.minister_applications for select to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "minapp insert" on public.minister_applications for insert to authenticated
  with check (user_id = auth.uid());
create policy "minapp admin" on public.minister_applications for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- reading_progress: each user owns their rows entirely.
drop policy if exists "progress all" on public.reading_progress;
create policy "progress all" on public.reading_progress for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- studies: public studies are readable by all; private ones by members/host.
-- INSERT is gated to verified ministers only — the core requirement.
drop policy if exists "studies read"   on public.studies;
drop policy if exists "studies insert" on public.studies;
drop policy if exists "studies update" on public.studies;
drop policy if exists "studies delete" on public.studies;
create policy "studies read" on public.studies for select to authenticated
  using (
    is_public
    or host_id = auth.uid()
    or private.is_study_member(id)
  );
create policy "studies insert" on public.studies for insert to authenticated
  with check (
    host_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and is_minister = true
    )
  );
create policy "studies update" on public.studies for update to authenticated
  using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy "studies delete" on public.studies for delete to authenticated
  using (host_id = auth.uid());

-- study_members: read members of studies you can see; a user joins/leaves
-- themselves; the host can manage their study's roster.
drop policy if exists "members read"  on public.study_members;
drop policy if exists "members join"  on public.study_members;
drop policy if exists "members leave" on public.study_members;
create policy "members read" on public.study_members for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.studies s
               where s.id = study_id and (s.is_public or s.host_id = auth.uid()))
  );
create policy "members join" on public.study_members for insert to authenticated
  with check (
    user_id = auth.uid()
    and role = 'member'
    and exists (select 1 from public.studies s where s.id = study_id and s.is_public)
  );
create policy "members leave" on public.study_members for delete to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from public.studies s where s.id = study_id and s.host_id = auth.uid()));

-- community_posts: all authenticated read; authors write their own; only
-- ministers/admins may post in the 'notice' category.
drop policy if exists "posts read"   on public.community_posts;
drop policy if exists "posts insert" on public.community_posts;
drop policy if exists "posts update" on public.community_posts;
drop policy if exists "posts delete" on public.community_posts;
create policy "posts read" on public.community_posts for select to authenticated using (true);
create policy "posts insert" on public.community_posts for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      category <> 'notice'
      or exists (select 1 from public.profiles where id = auth.uid() and (is_minister or role = 'admin'))
    )
  );
create policy "posts update" on public.community_posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "posts delete" on public.community_posts for delete to authenticated
  using (author_id = auth.uid());
