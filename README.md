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

This version is fully client-side. Saved loans and demo user profiles are stored in the browser with `localStorage` under `loan-sim:*` keys.

Important: the built-in profile/login flow is only a local demo convenience. It is not real authentication, and local profile passwords are not suitable for production account security.

## Deployment

This app can deploy to Vercel as a standard Vite project:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

No Supabase setup is required for the current client-only version. Supabase would be useful if you want real cloud accounts, cross-device saved loans, and secure authentication.

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
