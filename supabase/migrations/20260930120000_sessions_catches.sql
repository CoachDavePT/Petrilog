-- PROJ-2: sessions (fishing trips) and catches, both owned by one profile and deleted with it.
-- The database guarantees: at most one running session per user (AC-9, EC-1), no overlapping
-- sessions (AC-16), catches only inside their session's window (AC-18, AC-24, EC-4, EC-9, EC-10),
-- catches only in the owner's own sessions (AC-32), owner-only access (AC-32, AC-33),
-- everything gone with the account (EC-11, AC-40).

-- For the overlap rule: uuid equality inside a gist exclusion constraint.
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------------------------

create table public.sessions (
  -- the app normally supplies the id (created when the form opens, EC-2 / EC-3)
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null,
  -- empty while the session is running
  ended_at timestamptz,
  water_name text,
  note text,
  latitude double precision,
  longitude double precision,
  accuracy_m integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- target of catches_session_owner_fkey: a catch can only point at a session of its own owner
  constraint sessions_id_user_id_key unique (id, user_id),

  -- minute-precise times
  constraint sessions_started_at_minute_check
    check (started_at = date_trunc('minute', started_at, 'UTC')),
  constraint sessions_ended_at_minute_check
    check (ended_at is null or ended_at = date_trunc('minute', ended_at, 'UTC')),
  -- duration 1 minute .. 48 hours once ended (AC-12, AC-15, EC-6)
  constraint sessions_duration_check
    check (ended_at is null
           or (ended_at - started_at) between interval '1 minute' and interval '48 hours'),

  constraint sessions_water_name_length_check
    check (water_name is null or char_length(water_name) between 1 and 80),
  constraint sessions_note_length_check
    check (note is null or char_length(note) between 1 and 500),

  -- position: all three fields or none ("Ohne Position")
  constraint sessions_latitude_range_check
    check (latitude is null or latitude between -90 and 90),
  constraint sessions_longitude_range_check
    check (longitude is null or longitude between -180 and 180),
  constraint sessions_accuracy_range_check
    check (accuracy_m is null or accuracy_m between 0 and 100000),
  constraint sessions_position_complete_check
    check ((latitude is null and longitude is null and accuracy_m is null)
           or (latitude is not null and longitude is not null and accuracy_m is not null))
);

comment on table public.sessions is
  'A fishing trip (PROJ-2). Owner-only via RLS; deleted with the profile; ended_at null = running.';

-- at most one running session per user (AC-9, EC-1)
create unique index sessions_one_running_per_user
  on public.sessions (user_id)
  where ended_at is null;

-- no two sessions of one user overlap; a running session counts as "until forever",
-- touching ends are allowed (AC-16, also under concurrent requests).
-- Added after sessions_one_running_per_user on purpose: Postgres checks a row's indexes in
-- creation order, so a second running session reports sessions_one_running_per_user (EC-1),
-- not this overlap (a running session always overlaps the other running one).
alter table public.sessions
  add constraint sessions_no_overlap
    exclude using gist (
      user_id with =,
      tstzrange(started_at, coalesce(ended_at, 'infinity'::timestamptz), '[)') with &&
    );

-- overview, newest first (AC-1, EC-12)
create index sessions_user_id_started_at_idx
  on public.sessions (user_id, started_at desc);

-- own water name suggestions (AC-7, AC-34)
create index sessions_user_id_water_name_idx
  on public.sessions (user_id, water_name);

-- ---------------------------------------------------------------------------------------------
-- catches
-- ---------------------------------------------------------------------------------------------

create table public.catches (
  -- the app normally supplies the id (created when the form opens, EC-2 / EC-3)
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  caught_at timestamptz not null,
  species text not null,
  species_other text,
  length_cm integer not null,
  weight_g integer,
  bait text,
  released boolean not null,
  latitude double precision,
  longitude double precision,
  accuracy_m integer,
  position_source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- the catch points at the pair (session, owner): no catch in someone else's session (AC-32);
  -- deleting the session deletes its catches (AC-19)
  constraint catches_session_owner_fkey
    foreign key (session_id, user_id)
    references public.sessions (id, user_id)
    on delete cascade,

  -- minute-precise
  constraint catches_caught_at_minute_check
    check (caught_at = date_trunc('minute', caught_at, 'UTC')),

  -- fixed species ids, display names live in the app (AC-21)
  constraint catches_species_check
    check (species in ('perch', 'pike', 'zander', 'eel', 'carp', 'tench', 'bream', 'roach',
                       'wels_catfish', 'brown_trout', 'rainbow_trout', 'sea_trout', 'cod',
                       'herring', 'garfish', 'flatfish', 'other')),
  -- free species name exactly for "Sonstige"
  constraint catches_species_other_check
    check ((species = 'other' and species_other is not null
            and char_length(species_other) between 1 and 40)
           or (species <> 'other' and species_other is null)),

  constraint catches_length_cm_check
    check (length_cm between 1 and 250),
  constraint catches_weight_g_check
    check (weight_g is null or weight_g between 1 and 150000),
  constraint catches_bait_length_check
    check (bait is null or char_length(bait) between 1 and 60),

  -- the catch keeps its own copy of the position (AC-38): all three fields or none
  constraint catches_latitude_range_check
    check (latitude is null or latitude between -90 and 90),
  constraint catches_longitude_range_check
    check (longitude is null or longitude between -180 and 180),
  constraint catches_accuracy_range_check
    check (accuracy_m is null or accuracy_m between 0 and 100000),
  constraint catches_position_complete_check
    check ((latitude is null and longitude is null and accuracy_m is null)
           or (latitude is not null and longitude is not null and accuracy_m is not null)),
  -- where the position came from; 'none' exactly when there is none (AC-25, AC-29)
  constraint catches_position_source_check
    check ((position_source = 'none' and latitude is null)
           or (position_source in ('gps', 'session') and latitude is not null))
);

comment on table public.catches is
  'A single catch inside a session (PROJ-2). Owner-only via RLS; deleted with its session and with the profile.';

-- detail view and the catch-time check
create index catches_session_id_caught_at_idx
  on public.catches (session_id, caught_at);

-- recently used species and form defaults
create index catches_user_id_created_at_idx
  on public.catches (user_id, created_at desc);

-- ---------------------------------------------------------------------------------------------
-- updated_at on both tables
-- ---------------------------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

create trigger sessions_set_updated_at
  before update on public.sessions
  for each row
  execute function public.set_updated_at();

create trigger catches_set_updated_at
  before update on public.catches
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Catch-time guarantee (AC-18, AC-24, EC-4, EC-9, EC-10)
-- A catch must lie in [started_at, ended_at]; for a running session the upper bound is now + 2 min.
-- Both checks lock the same session row, so ending/moving a session and saving a catch take turns:
-- the catch check takes FOR SHARE, the session update holds the row lock of its UPDATE.
-- The rejection message is exactly 'catch_outside_session'; the app maps that string.
-- ---------------------------------------------------------------------------------------------

create function public.check_catch_in_session()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_started_at timestamptz;
  v_ended_at timestamptz;
begin
  select s.started_at, s.ended_at
    into v_started_at, v_ended_at
    from public.sessions s
    where s.id = new.session_id
      and s.user_id = new.user_id
    for share;

  -- no visible session of this owner: catches_session_owner_fkey / RLS reject the row
  if not found then
    return new;
  end if;

  if new.caught_at < v_started_at
     or new.caught_at > coalesce(v_ended_at, pg_catalog.now() + interval '2 minutes') then
    raise exception 'catch_outside_session';
  end if;

  return new;
end;
$$;

revoke execute on function public.check_catch_in_session() from public, anon, authenticated;

create trigger catches_check_in_session
  before insert or update of caught_at, session_id on public.catches
  for each row
  execute function public.check_catch_in_session();

create function public.check_session_keeps_catches()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
      from public.catches c
      where c.session_id = new.id
        and (c.caught_at < new.started_at
             or c.caught_at > coalesce(new.ended_at, pg_catalog.now() + interval '2 minutes'))
  ) then
    raise exception 'catch_outside_session';
  end if;

  return new;
end;
$$;

revoke execute on function public.check_session_keeps_catches() from public, anon, authenticated;

create trigger sessions_check_keeps_catches
  before update of started_at, ended_at on public.sessions
  for each row
  execute function public.check_session_keeps_catches();

-- ---------------------------------------------------------------------------------------------
-- Access: owner only (AC-32), nothing for anonymous callers (AC-33). The app writes with the
-- user's session, never with the service key.
-- ---------------------------------------------------------------------------------------------

alter table public.sessions enable row level security;
alter table public.catches enable row level security;

revoke all on table public.sessions from anon, authenticated;
revoke all on table public.catches from anon, authenticated;
grant select, insert, update, delete on table public.sessions to authenticated;
grant select, insert, update, delete on table public.catches to authenticated;

create policy "sessions_select_own"
  on public.sessions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "sessions_insert_own"
  on public.sessions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "sessions_update_own"
  on public.sessions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "sessions_delete_own"
  on public.sessions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "catches_select_own"
  on public.catches
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "catches_insert_own"
  on public.catches
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "catches_update_own"
  on public.catches
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "catches_delete_own"
  on public.catches
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
