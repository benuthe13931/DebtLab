create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  email text not null,
  theme_id text not null default 'sky',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_loans (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.paycheck_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_loans_user_id_idx on public.saved_loans(user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, email)
  values (
    new.id,
    coalesce(new.email, new.id::text),
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(coalesce(new.email, 'LoanSim User'), '@', 1)),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists saved_loans_set_updated_at on public.saved_loans;
create trigger saved_loans_set_updated_at
before update on public.saved_loans
for each row execute function public.set_updated_at();

drop trigger if exists paycheck_plans_set_updated_at on public.paycheck_plans;
create trigger paycheck_plans_set_updated_at
before update on public.paycheck_plans
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.saved_loans enable row level security;
alter table public.paycheck_plans enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can create own profile" on public.profiles;
create policy "Users can create own profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Users can delete own profile" on public.profiles;
create policy "Users can delete own profile"
on public.profiles
for delete
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can read own loans" on public.saved_loans;
create policy "Users can read own loans"
on public.saved_loans
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own loans" on public.saved_loans;
create policy "Users can create own loans"
on public.saved_loans
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own loans" on public.saved_loans;
create policy "Users can update own loans"
on public.saved_loans
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own loans" on public.saved_loans;
create policy "Users can delete own loans"
on public.saved_loans
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own paycheck plan" on public.paycheck_plans;
create policy "Users can read own paycheck plan"
on public.paycheck_plans
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own paycheck plan" on public.paycheck_plans;
create policy "Users can create own paycheck plan"
on public.paycheck_plans
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own paycheck plan" on public.paycheck_plans;
create policy "Users can update own paycheck plan"
on public.paycheck_plans
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own paycheck plan" on public.paycheck_plans;
create policy "Users can delete own paycheck plan"
on public.paycheck_plans
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- RLS policies filter rows, but the Data API roles also need table privileges
-- before PostgreSQL will evaluate those policies.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.saved_loans to authenticated;
grant select, insert, update, delete on table public.paycheck_plans to authenticated;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  delete from auth.users where id = current_user_id;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
