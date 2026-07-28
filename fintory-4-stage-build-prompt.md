# Fintory — 4-Stage Build Prompt Set for Claude Code

Give these to Claude Code **one stage at a time, in order**. Each stage is a self-contained prompt —
paste Stage 1 first, let it finish and review the output, then paste Stage 2, and so on. Each stage
assumes everything in the prior stages is already built.

**Explicitly out of scope for all four stages below:** end-to-end performance testing and dedicated
security testing (load testing, penetration testing). Those will be handled as a separate track later.
Do not write test suites for either.

**Architecture note — single unified app, not a separate frontend/backend:**
This is one Node.js/Express application. Express serves the REST API under `/api/v1/...` **and**
serves the built React (Vite) frontend as static files for every other route, with a catch-all
falling through to `index.html` so client-side routing works. There is exactly one `package.json`
at the root, one build step, one Node process, and one Render Web Service — not two deployments
talking to each other over HTTP.

In development, run the Vite dev server for hot-reload on the frontend, with its dev-server proxy
forwarding `/api/*` requests to the local Express server. In production there is no Vite dev server
at all — Express just serves the static build output directly.

**Tech stack (fixed across all stages):**
- Frontend: Vite + React + Tailwind CSS (built as static assets, served by Express)
- Backend: Node.js + Express.js (same process serves API + frontend)
- Database: Neon PostgreSQL, via **Drizzle ORM**
- Auth: Better Auth
- Hosting: Render — **one Web Service**
- Validation: **Zod** (schemas shared between frontend forms and backend routes)
- Language: TypeScript everywhere
- Repo layout (single project, not a monorepo of separate deployable apps):

```
/fintory
  /client         → React + Tailwind source (built by Vite)
  /server         → Express app: routes, auth, db access, background jobs
  /shared         → Zod schemas, currency/date utils, shared TypeScript types
  /server/public  → Vite build output — Express serves this as static files in production
  package.json    → single root package.json with scripts for dev, build, start
```

---

## STAGE 1 PROMPT — Foundation & Core Data Model

```
Build the foundation of Fintory, a full-stack personal finance web app, using this stack:
Vite + React + Tailwind (frontend), Node.js + Express (backend), Neon PostgreSQL via Drizzle ORM,
Better Auth, deployed on Render. Use TypeScript everywhere.

Build this as ONE unified application, not separate frontend/backend deployments: a single Express
server that serves the REST API under /api/v1/... and also serves the built React (Vite) frontend
as static files for every other route (with a catch-all to index.html for client-side routing).
One package.json, one build step, one Node process, one Render Web Service. Use a Vite dev-server
proxy for /api/* only during local development — production has no separate frontend process.

Repo layout: /client (React + Tailwind source), /server (Express app, routes, db, jobs),
/shared (Zod schemas and shared types used by both client and server code), /server/public
(Vite build output, served statically by Express in production).

Scope for this stage only:

1. Repo & infra setup
   - Single-project scaffold as described above
   - One Render deployment config (render.yaml) defining the single Web Service: build command
     builds the client into /server/public, then starts the Express server
   - Environment variable handling with a single checked-in .env.example
   - Basic GitHub Actions workflow that runs lint + typecheck + unit tests on every PR

2. Authentication
   - Email/password auth via Better Auth
   - Session handling with secure, httpOnly cookies

3. Database schema (propose this to me for review before writing migrations)
   - users (extended with default_display_currency)
   - categories (seeded defaults: Groceries, Dining, Transport, Utilities, Entertainment,
     Shopping, Health, Other; user-customizable)
   - expenses (user_id, amount, currency, category_id, vendor, date, source [manual|scanned],
     receipt_url, notes, created_at, updated_at)
   - loans (user_id, lender, type, principal, currency, apr, term_months, monthly_payment, start_date)
   - savings_accounts (user_id, name, institution, type, currency, balance, target_amount, apy,
     monthly_contribution)
   - assets (user_id, name, type, currency, current_value, purchase_price, purchase_date)
   - Every user-owned table needs a user_id foreign key AND a Postgres Row-Level Security (RLS)
     policy restricting access to the owning user. Enable RLS, don't just filter in application code.
   - Store native amount + currency code on every monetary record — never store only a converted
     value. (Multi-currency conversion logic comes in Stage 2, but the schema must support it now.)

4. Core CRUD
   - REST API under /api/v1/... for expenses, loans, savings_accounts, assets, categories
   - Zod validation on every request body, shared between frontend forms and backend routes
   - Standard error shape: { error: { code, message } }
   - Pagination (cursor-based) on list endpoints

5. Frontend
   - Auth pages (sign up, log in, log out)
   - Add/edit/delete forms for expenses, loans, savings, assets
   - A basic dashboard showing: this month's total spend, category breakdown, and a simple
     net worth figure (assets + savings − debt). Single-currency math is fine for now — just make
     sure every amount displayed also shows its currency code, since multi-currency conversion is
     Stage 2.
   - Loan cards should compute outstanding principal and months remaining from
     principal/APR/term/payment/start date via standard amortization math — don't require the user
     to manually re-enter a current balance.

6. Testing (unit/integration only — no performance or security test suites)
   - Unit tests for the amortization math
   - Integration tests for auth flow and CRUD endpoints

Before writing implementation code, show me the full schema and API route list for review.
After finishing, give me a summary of what was built, how to run it locally, and any decisions
you made that I should know about.
```

---

## STAGE 2 PROMPT — Multi-Currency, Budgets & Recurring Detection

```
Continue building Fintory on top of the Stage 1 foundation (auth, schema, core CRUD, basic dashboard
already exist). This stage adds correct multi-currency handling and the core budgeting features.

Scope for this stage only:

1. Multi-currency conversion, done correctly
   - Add an fx_rates_history table (date, base_currency, rates JSONB)
   - Add a scheduled job (BullMQ + Redis on Render) that fetches and stores daily rates from a
     provider that supports historical lookups (e.g. exchangerate.host or Fixer.io) — do not rely on
     a "latest rates only" endpoint
   - Conversions must use the historical rate for the date of the transaction being converted, not
     today's rate. A March expense converts at March's rate even when viewed in July.
   - Centralize ALL currency formatting and conversion logic in ONE module in /shared,
     imported by both the client and server code. Do not let a second formatting function exist
     anywhere else in the codebase — a duplicate formatter silently overriding the correct one is a
     known failure mode here.
   - Users set a default display currency (already on the users table from Stage 1). Every dashboard
     aggregate (monthly total, category breakdown, net worth) converts each record into the display
     currency using its historical rate before summing.
   - Individual transaction/account views always show the record's native currency; only aggregate
     views show converted totals, clearly labeled with the currency in use.

2. Budgets
   - budgets table: user_id, category_id, monthly_limit, currency, alert_threshold_pct
   - CRUD for budgets
   - Backend logic that checks spend-to-date against each budget and triggers an alert when the
     configurable threshold (e.g. 80%, 100%) is crossed
   - Email alerts via Resend or SendGrid when a threshold is crossed
   - In-app notification list (notifications table: user_id, type, payload, sent_at, read_at)

3. Recurring transaction detection
   - A job that scans expense history per user and flags vendors charging on a regular cadence
     (e.g. same vendor, similar amount, ~monthly interval) as likely subscriptions
   - Surface flagged recurring items in the UI with an option to confirm/dismiss

4. Bill & loan payment reminders
   - Scheduled reminders (via BullMQ) ahead of loan payment due dates, sent by email

5. Transaction management improvements
   - Editing and deleting existing expenses
   - Splitting a single expense across multiple categories
   - Free-text tagging on expenses
   - Search, filter, and sort across all transactions (date range, category, amount, vendor, currency)

6. Export
   - CSV export of transactions
   - PDF export of a simple monthly report (total spend, category breakdown, net worth snapshot)

7. Testing (unit/integration only)
   - Unit tests for the currency conversion logic (including historical-rate lookups) and the
     budget-threshold logic — these are the functions where a silent bug is most costly
   - Integration tests for the budget alert flow and CSV/PDF export

After finishing, summarize what was built and flag anything from Stage 1 you had to revisit.
```

---

## STAGE 3 PROMPT — Bank Linking, Receipt Scanning & Trust/Compliance

```
Continue building Fintory. Stages 1-2 (foundation, multi-currency, budgets) are done. This stage adds
external data sources and the trust/compliance layer expected of an app handling real financial data.

Scope for this stage only:

1. Bank/card account linking
   - Integrate Plaid for read-only bank/card account and transaction linking
   - New tables: linked_accounts, linked_transactions
   - Encrypt Plaid access tokens at rest with field-level encryption — do not store them as plain
     text even though the database itself is encrypted
   - A sync job that periodically pulls new transactions from linked accounts into the expenses flow,
     tagged with their source so the user can distinguish linked vs. manual vs. scanned entries
   - Deduplication logic so a manually-entered expense that later shows up via bank sync doesn't
     create a duplicate record

2. Receipt scanning
   - Photo upload flow, image stored in object storage (Cloudflare R2, S3-compatible)
   - Server-side only call to the Claude API (vision) to extract vendor, amount, currency, date, and
     category from the photo as structured JSON. The frontend must never hold or call this directly.
   - Always show the extracted fields to the user in an editable review form before saving — never
     auto-save an AI extraction without confirmation
   - Rate-limit this endpoint specifically (express-rate-limit + Redis), since each call costs money

3. Audit trail
   - audit_log table: user_id, entity_type, entity_id, action, diff (JSONB), timestamp
   - Every create/update/delete on expenses, loans, savings_accounts, and assets writes an audit
     log entry

4. Compliance basics
   - Privacy Policy and Terms of Service pages (static content is fine — I'll supply or approve final
     copy, just build the pages and routing)
   - "Download my data" endpoint that exports all of a user's records as JSON
   - Account deletion flow that removes a user's data (or anonymizes it per a retention policy we'll
     define together — ask me which approach before implementing)
   - Document (in the README) that Neon's point-in-time recovery is enabled and how to restore from
     it — this is documentation, not a test suite

5. Testing (unit/integration only — no performance or security test suites)
   - Unit tests for the deduplication logic and the audit log writer
   - Integration test for the receipt-scan review-and-confirm flow

Flag anything where Plaid's sandbox vs. production requirements affect the build, and ask before
making a compliance-related judgment call I haven't specified (e.g. data retention period on
account deletion).
```

---

## STAGE 4 PROMPT — Differentiators & Polish

```
Continue building Fintory. Stages 1-3 (foundation, multi-currency/budgets, bank linking/receipt
scanning/compliance) are done. This final stage adds the features that separate a good app from a
great one, plus general polish.

Scope for this stage only:

1. Spending insights
   - Simple natural-language callouts on the dashboard, e.g. "You spent 20% more on dining this
     month than last month" — computed from existing category data, no new ML needed

2. Shared/family accounts
   - Allow a user to invite another user to share visibility into their budget
   - Permission levels: view-only vs. edit
   - Respect existing Row-Level Security design — extend policies rather than bypassing them

3. Anomaly detection
   - Flag transactions that look like duplicates (same vendor, same amount, same day) or unusual
     for a vendor (amount far outside that vendor's typical range for this user)

4. Accessibility
   - WCAG AA pass: keyboard navigation throughout, proper ARIA labels, verify color contrast on
     category colors and status indicators (this is an accessibility audit, not a performance or
     security test)

5. Dark mode
   - Full dark theme via Tailwind, respecting prefers-color-scheme by default with a manual toggle

6. Internationalization scaffolding
   - Set up i18n infrastructure (e.g. react-i18next) with English populated; structure so additional
     languages can be added without code changes later

7. Offline support
   - Basic offline read access to already-loaded data with a sync-on-reconnect flow for anything
     entered while offline

Summarize what was built and give me a final overview of the full app: what's implemented, what's
explicitly deferred, and any known limitations.
```
