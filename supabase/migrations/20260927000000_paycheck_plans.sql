create table if not exists public.paycheck_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists paycheck_plans_set_updated_at on public.paycheck_plans;
create trigger paycheck_plans_set_updated_at
before update on public.paycheck_plans
for each row execute function public.set_updated_at();

alter table public.paycheck_plans enable row level security;

drop policy if exists "Users can read own paycheck plan" on public.paycheck_plans;
create policy "Users can read own paycheck plan"
on public.paycheck_plans for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create own paycheck plan" on public.paycheck_plans;
create policy "Users can create own paycheck plan"
on public.paycheck_plans for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own paycheck plan" on public.paycheck_plans;
create policy "Users can update own paycheck plan"
on public.paycheck_plans for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own paycheck plan" on public.paycheck_plans;
create policy "Users can delete own paycheck plan"
on public.paycheck_plans for delete to authenticated
using ((select auth.uid()) = user_id);
