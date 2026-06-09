# LoanSim

LoanSim is a client-side loan interest simulator for testing payoff strategies, payment timing, pauses, one-time payments, and what-if scenarios.

## Features

- Daily interest payoff modeling
- Assumed payment schedules
- Historical payment replay
- What-if projections
- Payment pauses, due-day changes, and recurring payment changes
- Multiple saved loans per local user profile
- Theme selection and local profile settings

## Local Development

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

## Build

```bash
npm run build
```

The production output is written to `dist/`.

## Data And Privacy

Without Supabase environment variables, LoanSim is fully client-side. Saved loans and demo user profiles are stored in the browser with `localStorage` under `loan-sim:*` keys.

Important: in local-only mode, the profile/login flow is only a demo convenience. Local profile passwords are not suitable for production account security.

With Supabase configured, LoanSim uses Supabase Auth plus Postgres tables for cloud profiles and saved loans. Row Level Security keeps each user's saved loans private to their authenticated Supabase user.

## Supabase Setup

1. Create a new Supabase project.
2. Open the Supabase SQL editor.
3. Run the SQL in `supabase/schema.sql`.
4. Copy `.env.example` to `.env`.
5. Fill in:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

6. Restart the dev server.

For Vercel, add the same two environment variables in the Vercel project settings before deploying.

The Supabase schema is also stored as a migration in `supabase/migrations/` if you want to manage database changes with the Supabase CLI.

## Deployment

This app can deploy to Vercel as a standard Vite project:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

No Supabase setup is required for local-only demo mode. Supabase is enabled automatically when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present.

## GitHub Safety

Commit source and config files, including:

- `src/`
- `public/`
- `package.json`
- `package-lock.json`
- Vite, TypeScript, ESLint, Tailwind, and PostCSS config files

Do not commit:

- `node_modules/`
- `dist/`
- `.env` or `.env.local`
- logs or editor-local files
