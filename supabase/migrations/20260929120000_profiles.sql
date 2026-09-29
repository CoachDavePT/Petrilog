-- PROJ-1: profiles — one per auth account, created automatically, deleted with the account.
-- Access: the owner may read their own profile; nobody writes it directly (AC-4, AC-14, AC-15).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'One profile per auth account (PROJ-1). Every user-data table references its owner with on delete cascade.';

alter table public.profiles enable row level security;

-- Only reading is granted; inserts come from the trigger below, deletes from the auth account cascade.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- Signup hook: exactly one profile per new auth account.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, created_at)
  values (new.id, coalesce(new.created_at, now()))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
