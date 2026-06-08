# DebtLab

DebtLab is a debt payoff planner with account-level debt modeling, payoff simulations, statement import helpers, authentication, and per-user saved planner data.

## Project Structure

- `frontend/` - Vite + TypeScript client
- `backend/` - NestJS API
- `data/` and `backend/data/` - local SQLite databases, ignored by git

## Local Setup

Install both apps:

```bash
npm run install:all
```

Create local env files from the examples:

```bash
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

Run the API and frontend in two terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

The frontend runs at `http://localhost:5173` and the API defaults to `http://localhost:8080`.

## Demo Login/Data

The app has email/password registration and login. Passwords are hashed with scrypt in the local database, and session tokens are stored in `localStorage`.

New accounts start empty. Use the in-app reset sample data action to load a fake demo portfolio with Chase/Best Buy/CareCredit/Student Loan sample debts. Do not commit local `.db` files because they can contain real emails, hashed passwords, session tokens, statement imports, payments, and debt details.

## GitHub Safety Checklist

Safe to commit:

- Source files in `frontend/src` and `backend/src`
- `package.json` and `package-lock.json` files
- Public assets in `frontend/public`
- `README.md`, `.gitignore`, and `.env.example` files

Do not commit:

- `node_modules/`
- `dist/`, `build/`, `coverage/`
- `.env`, `.env.local`, or other real env files
- `.vercel/`
- `data/*.db`, `backend/data/*.db`, or SQLite sidecar files

## Deployment Notes

Vercel can deploy the frontend from GitHub automatically. Vercel creates preview deployments for branches and production deployments from the production branch when the repository is connected.

This repo currently uses a Nest backend plus SQLite. SQLite is good for local development, but it is not durable on Vercel serverless deployments because serverless filesystems are ephemeral. For a resume-ready public deployment, use one of these paths:

1. **Recommended:** migrate the backend persistence layer to Supabase/Postgres, then deploy the frontend and API together or deploy the API separately.
2. **Practical short-term:** deploy the frontend to Vercel and deploy the Nest API on a long-running Node host such as Railway, Render, or Fly.io, with a persistent database.
3. **Demo-only:** wire the API into Vercel Functions with temporary storage, knowing user-created data will not be reliable.

If deploying the frontend separately from the API, set these Vercel environment variables:

```env
VITE_API_BASE=https://your-api.example.com/api/planner
VITE_AUTH_BASE=https://your-api.example.com/api/auth
```

For a Supabase migration, mirror the EurovisionRanker pattern: keep SQL migrations under `supabase/migrations`, commit `.env.example`, keep real Supabase keys in Vercel environment variables, and do not commit `.env`.
