-- PROJ-3: weather snapshot per session (at its start) and per catch (at its catch time), stored in
-- the entry's own row (design.md → Datenmodell). The database guarantees:
--   * a new entry never starts with weather; the status follows the position (AC-7)
--   * changing the reference time or the position discards the weather (AC-11, AC-12, AC-13)
--   * status and values always agree (ok ⇔ hour + fetch time; values only when ok, never all empty)
-- The app writes weather conditionally (same reference time, position present, status pending/failed),
-- so a late answer for an old time can never land (EC-1, EC-2) and a snapshot exists at most once
-- (EC-3). Access stays owner-only via the RLS policies of PROJ-2 (AC-19); deleting the row deletes
-- its weather (AC-22).

-- ---------------------------------------------------------------------------------------------
-- Columns (same set on both tables)
-- ---------------------------------------------------------------------------------------------

alter table public.sessions
  add column weather_status text,
  add column weather_requested_at timestamptz,
  add column weather_attempted_at timestamptz,
  add column weather_hour timestamptz,
  add column weather_temperature_c numeric(4, 1),
  add column weather_pressure_hpa numeric(5, 1),
  add column weather_wind_speed_kmh numeric(4, 1),
  add column weather_wind_direction_deg smallint,
  add column weather_cloud_cover_pct smallint,
  add column weather_precipitation_mm numeric(5, 1),
  add column weather_code smallint,
  add column weather_fetched_at timestamptz;

alter table public.catches
  add column weather_status text,
  add column weather_requested_at timestamptz,
  add column weather_attempted_at timestamptz,
  add column weather_hour timestamptz,
  add column weather_temperature_c numeric(4, 1),
  add column weather_pressure_hpa numeric(5, 1),
  add column weather_wind_speed_kmh numeric(4, 1),
  add column weather_wind_direction_deg smallint,
  add column weather_cloud_cover_pct smallint,
  add column weather_precipitation_mm numeric(5, 1),
  add column weather_code smallint,
  add column weather_fetched_at timestamptz;

-- Existing entries (before PROJ-3): with a position they wait for weather and are fetched on the
-- next open (AC-9); without one they never get any.
update public.sessions
  set weather_status = case when latitude is null then 'no_position' else 'pending' end,
      weather_requested_at = now();

update public.catches
  set weather_status = case when latitude is null then 'no_position' else 'pending' end,
      weather_requested_at = now();

alter table public.sessions
  alter column weather_status set default 'no_position',
  alter column weather_status set not null,
  alter column weather_requested_at set default now(),
  alter column weather_requested_at set not null;

alter table public.catches
  alter column weather_status set default 'no_position',
  alter column weather_status set not null,
  alter column weather_requested_at set default now(),
  alter column weather_requested_at set not null;

-- ---------------------------------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------------------------------

alter table public.sessions
  add constraint sessions_weather_status_check
    check (weather_status in ('pending', 'ok', 'failed', 'no_position')),
  -- no position ⇔ no weather is ever fetched
  add constraint sessions_weather_position_check
    check ((weather_status = 'no_position') = (latitude is null)),
  -- ok ⇔ the hour and the fetch time are known
  add constraint sessions_weather_ok_check
    check ((weather_status = 'ok') = (weather_hour is not null and weather_fetched_at is not null)),
  -- values only when ok ...
  add constraint sessions_weather_values_only_ok_check
    check (weather_status = 'ok'
           or (weather_temperature_c is null and weather_pressure_hpa is null
               and weather_wind_speed_kmh is null and weather_wind_direction_deg is null
               and weather_cloud_cover_pct is null and weather_precipitation_mm is null
               and weather_code is null)),
  -- ... and never all of them empty when ok (a response without any value counts as failed)
  add constraint sessions_weather_ok_has_value_check
    check (weather_status <> 'ok'
           or weather_temperature_c is not null or weather_pressure_hpa is not null
           or weather_wind_speed_kmh is not null or weather_wind_direction_deg is not null
           or weather_cloud_cover_pct is not null or weather_precipitation_mm is not null
           or weather_code is not null),
  add constraint sessions_weather_hour_check
    check (weather_hour is null or weather_hour = date_trunc('hour', weather_hour, 'UTC')),
  add constraint sessions_weather_temperature_check
    check (weather_temperature_c is null or weather_temperature_c between -70 and 60),
  add constraint sessions_weather_pressure_check
    check (weather_pressure_hpa is null or weather_pressure_hpa between 850 and 1100),
  add constraint sessions_weather_wind_speed_check
    check (weather_wind_speed_kmh is null or weather_wind_speed_kmh between 0 and 500),
  add constraint sessions_weather_wind_direction_check
    check (weather_wind_direction_deg is null or weather_wind_direction_deg between 0 and 360),
  add constraint sessions_weather_cloud_cover_check
    check (weather_cloud_cover_pct is null or weather_cloud_cover_pct between 0 and 100),
  add constraint sessions_weather_precipitation_check
    check (weather_precipitation_mm is null or weather_precipitation_mm between 0 and 1000),
  add constraint sessions_weather_code_check
    check (weather_code is null or weather_code between 0 and 99);

alter table public.catches
  add constraint catches_weather_status_check
    check (weather_status in ('pending', 'ok', 'failed', 'no_position')),
  add constraint catches_weather_position_check
    check ((weather_status = 'no_position') = (latitude is null)),
  add constraint catches_weather_ok_check
    check ((weather_status = 'ok') = (weather_hour is not null and weather_fetched_at is not null)),
  add constraint catches_weather_values_only_ok_check
    check (weather_status = 'ok'
           or (weather_temperature_c is null and weather_pressure_hpa is null
               and weather_wind_speed_kmh is null and weather_wind_direction_deg is null
               and weather_cloud_cover_pct is null and weather_precipitation_mm is null
               and weather_code is null)),
  add constraint catches_weather_ok_has_value_check
    check (weather_status <> 'ok'
           or weather_temperature_c is not null or weather_pressure_hpa is not null
           or weather_wind_speed_kmh is not null or weather_wind_direction_deg is not null
           or weather_cloud_cover_pct is not null or weather_precipitation_mm is not null
           or weather_code is not null),
  add constraint catches_weather_hour_check
    check (weather_hour is null or weather_hour = date_trunc('hour', weather_hour, 'UTC')),
  add constraint catches_weather_temperature_check
    check (weather_temperature_c is null or weather_temperature_c between -70 and 60),
  add constraint catches_weather_pressure_check
    check (weather_pressure_hpa is null or weather_pressure_hpa between 850 and 1100),
  add constraint catches_weather_wind_speed_check
    check (weather_wind_speed_kmh is null or weather_wind_speed_kmh between 0 and 500),
  add constraint catches_weather_wind_direction_check
    check (weather_wind_direction_deg is null or weather_wind_direction_deg between 0 and 360),
  add constraint catches_weather_cloud_cover_check
    check (weather_cloud_cover_pct is null or weather_cloud_cover_pct between 0 and 100),
  add constraint catches_weather_precipitation_check
    check (weather_precipitation_mm is null or weather_precipitation_mm between 0 and 1000),
  add constraint catches_weather_code_check
    check (weather_code is null or weather_code between 0 and 99);

-- ---------------------------------------------------------------------------------------------
-- Weather reset (AC-7, AC-11 – AC-13)
-- Insert: whatever weather was sent is dropped; pending with a position, no_position without.
-- Update of the reference time (sessions.started_at / catches.caught_at) or of the position: the
-- same reset. Any other update (end time, names, catch details, the weather write itself) keeps the
-- weather columns as written — the rules above still apply. A session's catches keep their own
-- position copy and therefore their weather when the session's position is removed.
-- ---------------------------------------------------------------------------------------------

create function public.reset_weather()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reset boolean;
begin
  if tg_op = 'INSERT' then
    v_reset := true;
  else
    v_reset := new.latitude is distinct from old.latitude
               or new.longitude is distinct from old.longitude;
    if tg_table_name = 'sessions' then
      v_reset := v_reset or new.started_at is distinct from old.started_at;
    else
      v_reset := v_reset or new.caught_at is distinct from old.caught_at;
    end if;
  end if;

  if v_reset then
    new.weather_status := case when new.latitude is null then 'no_position' else 'pending' end;
    new.weather_requested_at := pg_catalog.now();
    new.weather_attempted_at := null;
    new.weather_hour := null;
    new.weather_temperature_c := null;
    new.weather_pressure_hpa := null;
    new.weather_wind_speed_kmh := null;
    new.weather_wind_direction_deg := null;
    new.weather_cloud_cover_pct := null;
    new.weather_precipitation_mm := null;
    new.weather_code := null;
    new.weather_fetched_at := null;
  end if;

  return new;
end;
$$;

revoke execute on function public.reset_weather() from public, anon, authenticated;

create trigger sessions_reset_weather
  before insert or update on public.sessions
  for each row
  execute function public.reset_weather();

create trigger catches_reset_weather
  before insert or update on public.catches
  for each row
  execute function public.reset_weather();

comment on column public.sessions.weather_status is
  'PROJ-3: pending | ok | failed | no_position — weather at started_at (nearest full hour).';
comment on column public.catches.weather_status is
  'PROJ-3: pending | ok | failed | no_position — weather at caught_at (nearest full hour).';
