# Supabase Setup

LoanSim can run fully locally with browser storage. To enable cloud accounts and saved loans, create a Supabase project and run `schema.sql` in the SQL editor.

Then set these environment variables locally and in Vercel:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The schema uses Supabase Auth plus Row Level Security. Each signed-in user can only access rows where `auth.uid()` matches the row owner.

For CLI-based migration management, keep new migration files under `supabase/migrations`.
