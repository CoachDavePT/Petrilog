-- PROJ-3, QA round 2 (BUG-2): a per-user budget for weather fetches, so one account cannot exhaust the
-- shared free Open-Meteo quota by calling „fehlendes Wetter holen" in parallel or after resetting its own
-- rows (EC-7). Pattern of PROJ-1's claim_mail_request: log and decide in one step, under a lock per user.
--
-- public.weather_fetch_log is server-internal: RLS on, no policies, no grants for anon/authenticated. The
-- only way in is claim_weather_budget(), which always acts for auth.uid(). Rows are kept one hour.

create table public.weather_fetch_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- how many entries this call was allowed to fetch (upper bound of its Open-Meteo requests)
  entries integer not null check (entries between 1 and 50),
  created_at timestamptz not null default now()
);

create index weather_fetch_log_user_created_idx on public.weather_fetch_log (user_id, created_at desc);

comment on table public.weather_fetch_log is
  'PROJ-3: weather fetches per user for the hourly budget (BUG-2). Server-internal, kept 1 hour.';

alter table public.weather_fetch_log enable row level security;
revoke all on table public.weather_fetch_log from public, anon, authenticated;
grant select, insert, delete on table public.weather_fetch_log to service_role;

-- Budget: at most 200 entries per user in the last 60 minutes. Returns true (and logs the call) when
-- p_entries still fit, false (and logs nothing) when they do not. Parallel calls of one user wait for
-- each other on the advisory lock, so they cannot all pass on the same count.
create function public.claim_weather_budget(p_entries integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_used integer;
begin
  if v_user is null or p_entries is null or p_entries < 1 or p_entries > 50 then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('petrilog-weather:' || v_user::text));

  select coalesce(sum(l.entries), 0)
    into v_used
    from public.weather_fetch_log l
    where l.user_id = v_user
      and l.created_at > pg_catalog.now() - interval '60 minutes';

  if v_used + p_entries > 200 then
    return false;
  end if;

  insert into public.weather_fetch_log (user_id, entries) values (v_user, p_entries);
  return true;
end;
$$;

revoke execute on function public.claim_weather_budget(integer) from public, anon;
grant execute on function public.claim_weather_budget(integer) to authenticated;

-- Retention: one hour is all the budget needs.
select cron.schedule(
  'petrilog-weather-fetch-log-cleanup',
  '*/15 * * * *',
  $$delete from public.weather_fetch_log where created_at < now() - interval '60 minutes'$$
);
