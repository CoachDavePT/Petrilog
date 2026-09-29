-- PROJ-1: log for the login brake, mail limit and signup limit, plus the account-state helper.
-- Server-only: RLS on without policies, no grants for anon/authenticated. The Next.js server
-- reaches both through the service-role key (AC-23 – AC-26, EC-8).

create table public.auth_throttle_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('login_attempt', 'mail_request', 'signup')),
  email text check (email is null or char_length(email) <= 254),
  ip text not null check (char_length(ip) <= 45),
  outcome text not null check (outcome in ('pending', 'failed', 'succeeded', 'allowed', 'blocked')),
  created_at timestamptz not null default now(),
  -- login attempts and mail requests are keyed by address; signups only by IP (data minimisation)
  constraint auth_throttle_events_email_by_kind check (
    (kind = 'signup' and email is null) or (kind <> 'signup' and email is not null)
  )
);

comment on table public.auth_throttle_events is
  'Login brake / mail limit / signup limit log (PROJ-1). Server-only, rows deleted after 24 h.';

create index auth_throttle_events_kind_email_created_idx
  on public.auth_throttle_events (kind, email, created_at);
create index auth_throttle_events_kind_ip_created_idx
  on public.auth_throttle_events (kind, ip, created_at);

alter table public.auth_throttle_events enable row level security;
revoke all on table public.auth_throttle_events from public, anon, authenticated;
grant select, insert, update, delete on table public.auth_throttle_events to service_role;

-- Account state of a normalised address: 'none' | 'unconfirmed' | 'confirmed'.
-- Only the server may call it — for anyone else it would reveal who has an account.
create function public.auth_account_state(p_email text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when u.id is null then 'none'
    when u.email_confirmed_at is null then 'unconfirmed'
    else 'confirmed'
  end
  from (select 1) as one
  left join auth.users u on lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

revoke execute on function public.auth_account_state(text) from public, anon, authenticated;
grant execute on function public.auth_account_state(text) to service_role;
