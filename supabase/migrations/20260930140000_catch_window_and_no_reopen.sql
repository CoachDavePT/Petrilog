-- PROJ-2, round 2 after QA. The earlier migrations stay frozen; this one replaces two trigger functions.
-- BUG-1 (AC-24, EC-6): a running session accepts catches only up to started_at + 48 hours (besides
--   now + 2 min), so a forgotten session can always be ended within its 48-hour limit.
-- BUG-3 (EC-13): an ended session never becomes running again — not even through the database API.

create or replace function public.check_catch_in_session()
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
     or new.caught_at > coalesce(
          v_ended_at,
          least(pg_catalog.now() + interval '2 minutes', v_started_at + interval '48 hours')
        ) then
    raise exception 'catch_outside_session';
  end if;

  return new;
end;
$$;

revoke execute on function public.check_catch_in_session() from public, anon, authenticated;

create or replace function public.check_session_keeps_catches()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.ended_at is not null and new.ended_at is null then
    raise exception 'session_already_ended';
  end if;

  if exists (
    select 1
      from public.catches c
      where c.session_id = new.id
        and (c.caught_at < new.started_at
             or c.caught_at > coalesce(
                  new.ended_at,
                  least(pg_catalog.now() + interval '2 minutes', new.started_at + interval '48 hours')
                ))
  ) then
    raise exception 'catch_outside_session';
  end if;

  return new;
end;
$$;

revoke execute on function public.check_session_keeps_catches() from public, anon, authenticated;
