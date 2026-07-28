# Fintory

A full-stack personal finance / budgeting app — expenses, loans, savings, assets, budgets,
multi-currency support, recurring-subscription detection, bank linking (Plaid), and
AI-assisted receipt scanning.

Single unified app: one Express server serves the REST API under `/api/v1/...` and the
built React (Vite) frontend as static files, on one Render Web Service.

## Stack

- Frontend: Vite + React + Tailwind CSS
- Backend: Node.js + Express (same process serves API + frontend)
- Database: Neon PostgreSQL, via Drizzle ORM, with Postgres Row-Level Security on every
  user-owned table
- Auth: Better Auth (email/password, httpOnly session cookies)
- Bank linking: Plaid
- Receipt scanning: Google Gemini (vision)
- FX rates: Fixer.io

## Local development

```bash
npm install
npm run dev       # Vite dev server + Express, proxied, hot reload
```

or production mode locally:

```bash
npm run build && npm start
```

Copy `.env.example` to `.env` and fill in the values — see that file for what's required
vs. optional. Optional integrations (Plaid, R2 receipt storage) degrade gracefully when
their env vars are unset: bank linking responds "not configured" and receipt photos fall
back to a non-durable in-memory data URL instead of erroring.

## Database migrations

Migrations live in `server/db/migrations/`, generated via `drizzle-kit generate` from
`server/db/schema.ts`, and are applied automatically on every server boot (`runMigrations()`
in `server/index.ts`) — there's no separate manual migration step for deploys.

## Backups — Neon point-in-time recovery

Neon's free tier includes point-in-time recovery (PITR): every write is retained for a
rolling window (check your project's plan for the exact retention period — typically 1–7
days), letting you restore the database to any moment within that window, not just to a
daily snapshot.

**To restore:**

1. Open the [Neon console](https://console.neon.tech) and select the Fintory project.
2. Go to the **Branches** tab and click **Restore** (or create a new branch from a past
   timestamp — this is non-destructive and doesn't touch the live branch).
3. Pick the timestamp to restore to. Neon creates a new branch with data as of that moment.
4. Verify the restored branch has what you expect, then either point `DATABASE_URL` at it
   (update the Render env var and redeploy) or use it to manually recover specific rows
   before discarding it.

This is a documentation note, not a tested runbook — the restore flow above hasn't been
exercised against this project's actual database. Practice it once against a throwaway
branch before you need it for real.

## Deployment

Render Web Service, defined in `render.yaml`. `npm run build` produces the client bundle
into `server/public/`; `npm start` runs the Express server, which serves that bundle,
runs pending migrations, and starts the in-process cron jobs (FX rate fetch, budget
threshold checks, recurring-transaction detection, loan reminders, Plaid transaction sync).
