-- PROJ-1: hourly clean-up jobs (AC-31, AC-32).
-- 1. Login-brake log rows are kept at most 24 hours.
-- 2. Accounts that were never confirmed are deleted 7 days after signup; the profile goes with them.

create extension if not exists pg_cron;

select cron.schedule(
  'petrilog-auth-throttle-cleanup',
  '5 * * * *',
  $$delete from public.auth_throttle_events where created_at < now() - interval '24 hours'$$
);

select cron.schedule(
  'petrilog-unconfirmed-accounts-cleanup',
  '15 * * * *',
  $$delete from auth.users where email_confirmed_at is null and created_at < now() - interval '7 days'$$
);
