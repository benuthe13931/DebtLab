-- The Supabase Data API requires both table privileges and matching RLS policies.
-- These grants expose operations only to signed-in users; the RLS policies still
-- restrict every operation to rows owned by auth.uid().
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.saved_loans to authenticated;
grant select, insert, update, delete on table public.paycheck_plans to authenticated;
