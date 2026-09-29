-- PROJ-1 (round 2, after QA BUG-4): the mail limit decides in one step, per address, under a lock.
-- Two concurrent requests for the same address queue up, so exactly one of them gets 'send' (EC-5).
-- Server-only like auth_account_state: for anyone else it would be a way to burn someone's quota.

alter table public.auth_throttle_events
  drop constraint auth_throttle_events_outcome_check,
  add constraint auth_throttle_events_outcome_check
    check (outcome in ('pending', 'failed', 'succeeded', 'allowed', 'blocked', 'duplicate'));

-- Answer: 'send' | 'duplicate' | 'limit' (AC-25, EC-5).
--   duplicate — an allowed mail for this address is younger than 10 s: no second mail, not counted
--   limit     — 3 allowed mails in the last 60 min: no mail
--   send      — logged as allowed, the caller requests the mail
create function public.claim_mail_request(p_email text, p_ip text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_answer text;
  v_outcome text;
begin
  -- one lock per address, released at the end of the transaction (the RPC call)
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('claim_mail_request:' || v_email, 0));

  if exists (
    select 1 from public.auth_throttle_events
    where kind = 'mail_request' and email = v_email and outcome = 'allowed'
      and created_at > pg_catalog.now() - interval '10 seconds'
  ) then
    v_answer := 'duplicate';
    v_outcome := 'duplicate';
  elsif (
    select count(*) from public.auth_throttle_events
    where kind = 'mail_request' and email = v_email and outcome = 'allowed'
      and created_at > pg_catalog.now() - interval '60 minutes'
  ) >= 3 then
    v_answer := 'limit';
    v_outcome := 'blocked';
  else
    v_answer := 'send';
    v_outcome := 'allowed';
  end if;

  insert into public.auth_throttle_events (kind, email, ip, outcome)
  values ('mail_request', v_email, p_ip, v_outcome);

  return v_answer;
end;
$$;

revoke execute on function public.claim_mail_request(text, text) from public, anon, authenticated;
grant execute on function public.claim_mail_request(text, text) to service_role;
