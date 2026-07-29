import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  varchar,
  numeric,
  integer,
  date,
  jsonb,
  index,
  uniqueIndex,
  pgPolicy,
} from "drizzle-orm/pg-core";

const CURRENT_USER = sql`current_setting('app.current_user_id', true)::uuid`;

// ---------------------------------------------------------------------------
// Better Auth core tables (schema mirrors what the Drizzle adapter expects).
// No RLS here: only Better Auth's own library code ever touches these tables,
// and session lookup during login has to happen before any session exists.
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  defaultDisplayCurrency: varchar("default_display_currency", { length: 3 })
    .notNull()
    .default("USD"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// Business tables — every one gets RLS keyed off app.current_user_id, set per
// request/transaction by server/middleware/withUserContext.ts. FORCE ROW LEVEL
// SECURITY is applied separately (drizzle-kit's enableRLS() only emits ENABLE,
// not FORCE) — see server/db/migrate.ts.
// ---------------------------------------------------------------------------

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    // NULL = global default category, shared and read-only to every user.
    userId: uuid("user_id").references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: varchar("color", { length: 7 }),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("categories_user_name_unique").on(t.userId, t.name),
    uniqueIndex("categories_global_name_unique")
      .on(t.name)
      .where(sql`${t.userId} IS NULL`),
    pgPolicy("categories_select_policy", {
      for: "select",
      to: "public",
      using: sql`${t.userId} IS NULL OR ${t.userId} = ${CURRENT_USER}`,
    }),
    // The OR clause (both sides NULL) lets the boot-time seed script upsert
    // the global default rows: it runs with no app.current_user_id set at
    // all, which per-request connections can never do (withUserContext
    // always sets it), so this can't be triggered by a regular user.
    pgPolicy("categories_insert_policy", {
      for: "insert",
      to: "public",
      withCheck: sql`${t.userId} = ${CURRENT_USER} OR (${t.userId} IS NULL AND ${CURRENT_USER} IS NULL)`,
    }),
    pgPolicy("categories_update_policy", {
      for: "update",
      to: "public",
      using: sql`${t.userId} = ${CURRENT_USER} OR (${t.userId} IS NULL AND ${CURRENT_USER} IS NULL)`,
      withCheck: sql`${t.userId} = ${CURRENT_USER} OR (${t.userId} IS NULL AND ${CURRENT_USER} IS NULL)`,
    }),
    pgPolicy("categories_delete_policy", {
      for: "delete",
      to: "public",
      using: sql`${t.userId} = ${CURRENT_USER}`,
    }),
    // Family sharing (Stage 4): a user who's been granted "accepted" access
    // to this row's owner can read it; "edit" permission additionally grants
    // write. Global rows (userId IS NULL) never match — owner_user_id can't
    // equal NULL — so shared access never reaches default categories.
    pgPolicy("categories_shared_select_policy", {
      for: "select",
      to: "public",
      using: sql`EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = ${t.userId} AND account_shares.shared_with_user_id = ${CURRENT_USER} AND account_shares.status = 'accepted')`,
    }),
    pgPolicy("categories_shared_write_policy", {
      for: "all",
      to: "public",
      using: sql`EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = ${t.userId} AND account_shares.shared_with_user_id = ${CURRENT_USER} AND account_shares.status = 'accepted' AND account_shares.permission = 'edit')`,
      withCheck: sql`EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = ${t.userId} AND account_shares.shared_with_user_id = ${CURRENT_USER} AND account_shares.status = 'accepted' AND account_shares.permission = 'edit')`,
    }),
  ],
).enableRLS();

export const expenseSourceEnum = pgEnum("expense_source", ["manual", "scanned", "linked"]);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 14, scale: 4 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    vendor: text("vendor").notNull(),
    date: date("date").notNull(),
    source: expenseSourceEnum("source").notNull().default("manual"),
    receiptUrl: text("receipt_url"),
    notes: text("notes"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("expenses_user_date_idx").on(t.userId, t.date),
    pgPolicy("expenses_rls_policy", {
      for: "all",
      to: "public",
      using: sql`${t.userId} = ${CURRENT_USER}`,
      withCheck: sql`${t.userId} = ${CURRENT_USER}`,
    }),
    pgPolicy("expenses_shared_select_policy", {
      for: "select",
      to: "public",
      using: sql`EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = ${t.userId} AND account_shares.shared_with_user_id = ${CURRENT_USER} AND account_shares.status = 'accepted')`,
    }),
    pgPolicy("expenses_shared_write_policy", {
      for: "all",
      to: "public",
      using: sql`EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = ${t.userId} AND account_shares.shared_with_user_id = ${CURRENT_USER} AND account_shares.status = 'accepted' AND account_shares.permission = 'edit')`,
      withCheck: sql`EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = ${t.userId} AND account_shares.shared_with_user_id = ${CURRENT_USER} AND account_shares.status = 'accepted' AND account_shares.permission = 'edit')`,
    }),
  ],
).enableRLS();

// Deliberately simpler than expenses (no categories/splits/receipts/tags) —
// this exists to power net income and cash-flow reporting, not a full
// income-tracking feature in its own right.
export const income = pgTable(
  "income",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 14, scale: 4 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    source: text("source").notNull(),
    date: date("date").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("income_user_date_idx").on(t.userId, t.date),
    pgPolicy("income_rls_policy", {
      for: "all",
      to: "public",
      using: sql`${t.userId} = ${CURRENT_USER}`,
      withCheck: sql`${t.userId} = ${CURRENT_USER}`,
    }),
    pgPolicy("income_shared_select_policy", {
      for: "select",
      to: "public",
      using: sql`EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = ${t.userId} AND account_shares.shared_with_user_id = ${CURRENT_USER} AND account_shares.status = 'accepted')`,
    }),
    pgPolicy("income_shared_write_policy", {
      for: "all",
      to: "public",
      using: sql`EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = ${t.userId} AND account_shares.shared_with_user_id = ${CURRENT_USER} AND account_shares.status = 'accepted' AND account_shares.permission = 'edit')`,
      withCheck: sql`EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = ${t.userId} AND account_shares.shared_with_user_id = ${CURRENT_USER} AND account_shares.status = 'accepted' AND account_shares.permission = 'edit')`,
    }),
  ],
).enableRLS();

export const loans = pgTable(
  "loans",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lender: text("lender").notNull(),
    type: varchar("type", { length: 50 }),
    principal: numeric("principal", { precision: 14, scale: 4 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    // Annual percentage rate stored as a percentage, e.g. 5.250 = 5.25%.
    apr: numeric("apr", { precision: 6, scale: 3 }).notNull(),
    termMonths: integer("term_months").notNull(),
    monthlyPayment: numeric("monthly_payment", { precision: 14, scale: 4 }).notNull(),
    startDate: date("start_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("loans_user_idx").on(t.userId),
    pgPolicy("loans_rls_policy", {
      for: "all",
      to: "public",
      using: sql`${t.userId} = ${CURRENT_USER}`,
      withCheck: sql`${t.userId} = ${CURRENT_USER}`,
    }),
    pgPolicy("loans_shared_select_policy", {
      for: "select",
      to: "public",
      using: sql`EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = ${t.userId} AND account_shares.shared_with_user_id = ${CURRENT_USER} AND account_shares.status = 'accepted')`,
    }),
    pgPolicy("loans_shared_write_policy", {
      for: "all",
      to: "public",
      using: sql`EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = ${t.userId} AND account_shares.shared_with_user_id = ${CURRENT_USER} AND account_shares.status = 'accepted' AND account_shares.permission = 'edit')`,
      withCheck: sql`EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = ${t.userId} AND account_shares.shared_with_user_id = ${CURRENT_USER} AND account_shares.status = 'accepted' AND account_shares.permission = 'edit')`,
    }),
  ],
).enableRLS();

export const savingsAccounts = pgTable(
  "savings_accounts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    institution: text("institution"),
    type: varchar("type", { length: 50 }),
    currency: varchar("currency", { length: 3 }).notNull(),
    balance: numeric("balance", { precision: 14, scale: 4 }).notNull().default("0"),
    targetAmount: numeric("target_amount", { precision: 14, scale: 4 }),
    apy: numeric("apy", { precision: 6, scale: 3 }),
    monthlyContribution: numeric("monthly_contribution", { precision: 14, scale: 4 }).default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("savings_accounts_user_idx").on(t.userId),
    pgPolicy("savings_accounts_rls_policy", {
      for: "all",
      to: "public",
      using: sql`${t.userId} = ${CURRENT_USER}`,
      withCheck: sql`${t.userId} = ${CURRENT_USER}`,
    }),
    pgPolicy("savings_accounts_shared_select_policy", {
      for: "select",
      to: "public",
      using: sql`EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = ${t.userId} AND account_shares.shared_with_user_id = ${CURRENT_USER} AND account_shares.status = 'accepted')`,
    }),
    pgPolicy("savings_accounts_shared_write_policy", {
      for: "all",
      to: "public",
      using: sql`EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = ${t.userId} AND account_shares.shared_with_user_id = ${CURRENT_USER} AND account_shares.status = 'accepted' AND account_shares.permission = 'edit')`,
      withCheck: sql`EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = ${t.userId} AND account_shares.shared_with_user_id = ${CURRENT_USER} AND account_shares.status = 'accepted' AND account_shares.permission = 'edit')`,
    }),
  ],
).enableRLS();

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: varchar("type", { length: 50 }),
    currency: varchar("currency", { length: 3 }).notNull(),
    currentValue: numeric("current_value", { precision: 14, scale: 4 }).notNull(),
    purchasePrice: numeric("purchase_price", { precision: 14, scale: 4 }),
    purchaseDate: date("purchase_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("assets_user_idx").on(t.userId),
    pgPolicy("assets_rls_policy", {
      for: "all",
      to: "public",
      using: sql`${t.userId} = ${CURRENT_USER}`,
      withCheck: sql`${t.userId} = ${CURRENT_USER}`,
    }),
    pgPolicy("assets_shared_select_policy", {
      for: "select",
      to: "public",
      using: sql`EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = ${t.userId} AND account_shares.shared_with_user_id = ${CURRENT_USER} AND account_shares.status = 'accepted')`,
    }),
    pgPolicy("assets_shared_write_policy", {
      for: "all",
      to: "public",
      using: sql`EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = ${t.userId} AND account_shares.shared_with_user_id = ${CURRENT_USER} AND account_shares.status = 'accepted' AND account_shares.permission = 'edit')`,
      withCheck: sql`EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = ${t.userId} AND account_shares.shared_with_user_id = ${CURRENT_USER} AND account_shares.status = 'accepted' AND account_shares.permission = 'edit')`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Stage 2 — multi-currency, budgets, recurring detection.
// ---------------------------------------------------------------------------

// Global reference data (Fixer's historical rates), not user-owned — no RLS.
// Fixer's free/basic plan only returns EUR-based rates, so baseCurrency is
// always "EUR" in practice; the column exists so a future plan upgrade (or
// provider swap) doesn't require a schema change.
export const fxRatesHistory = pgTable(
  "fx_rates_history",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    date: date("date").notNull(),
    baseCurrency: varchar("base_currency", { length: 3 }).notNull(),
    rates: jsonb("rates").notNull().$type<Record<string, number>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("fx_rates_history_date_base_unique").on(t.date, t.baseCurrency)],
);

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    monthlyLimit: numeric("monthly_limit", { precision: 14, scale: 4 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    alertThresholdPct: numeric("alert_threshold_pct", { precision: 5, scale: 2 }).notNull().default("80"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("budgets_user_category_unique").on(t.userId, t.categoryId),
    pgPolicy("budgets_rls_policy", {
      for: "all",
      to: "public",
      using: sql`${t.userId} = ${CURRENT_USER}`,
      withCheck: sql`${t.userId} = ${CURRENT_USER}`,
    }),
    pgPolicy("budgets_shared_select_policy", {
      for: "select",
      to: "public",
      using: sql`EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = ${t.userId} AND account_shares.shared_with_user_id = ${CURRENT_USER} AND account_shares.status = 'accepted')`,
    }),
    pgPolicy("budgets_shared_write_policy", {
      for: "all",
      to: "public",
      using: sql`EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = ${t.userId} AND account_shares.shared_with_user_id = ${CURRENT_USER} AND account_shares.status = 'accepted' AND account_shares.permission = 'edit')`,
      withCheck: sql`EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = ${t.userId} AND account_shares.shared_with_user_id = ${CURRENT_USER} AND account_shares.status = 'accepted' AND account_shares.permission = 'edit')`,
    }),
  ],
).enableRLS();

export const notificationTypeEnum = pgEnum("notification_type", [
  "budget_threshold",
  "recurring_detected",
  "loan_reminder",
  "anomaly_detected",
]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_created_idx").on(t.userId, t.createdAt),
    pgPolicy("notifications_rls_policy", {
      for: "all",
      to: "public",
      using: sql`${t.userId} = ${CURRENT_USER}`,
      withCheck: sql`${t.userId} = ${CURRENT_USER}`,
    }),
  ],
).enableRLS();

export const recurringStatusEnum = pgEnum("recurring_status", ["pending", "confirmed", "dismissed"]);

export const recurringExpenses = pgTable(
  "recurring_expenses",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    vendor: text("vendor").notNull(),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    averageAmount: numeric("average_amount", { precision: 14, scale: 4 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    cadenceDays: integer("cadence_days").notNull(),
    lastSeenDate: date("last_seen_date").notNull(),
    status: recurringStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("recurring_expenses_user_vendor_currency_unique").on(t.userId, t.vendor, t.currency),
    pgPolicy("recurring_expenses_rls_policy", {
      for: "all",
      to: "public",
      using: sql`${t.userId} = ${CURRENT_USER}`,
      withCheck: sql`${t.userId} = ${CURRENT_USER}`,
    }),
  ],
).enableRLS();

// Denormalized userId (rather than an RLS policy that subqueries `expenses`)
// keeps the policy a simple, fast, direct column check consistent with every
// other business table instead of a special-cased join.
export const expenseSplits = pgTable(
  "expense_splits",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    amount: numeric("amount", { precision: 14, scale: 4 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("expense_splits_expense_idx").on(t.expenseId),
    pgPolicy("expense_splits_rls_policy", {
      for: "all",
      to: "public",
      using: sql`${t.userId} = ${CURRENT_USER}`,
      withCheck: sql`${t.userId} = ${CURRENT_USER}`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Stage 3 — bank linking (Plaid), receipt scanning, audit trail.
// ---------------------------------------------------------------------------

export const linkedAccounts = pgTable(
  "linked_accounts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    plaidItemId: text("plaid_item_id").notNull(),
    // AES-256-GCM ciphertext (server/lib/encryption.ts) — never the raw Plaid
    // access token, even though the database itself is encrypted at rest too.
    encryptedAccessToken: text("encrypted_access_token").notNull(),
    institutionName: text("institution_name").notNull(),
    accountName: text("account_name").notNull(),
    accountType: varchar("account_type", { length: 50 }),
    mask: varchar("mask", { length: 8 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("linked_accounts_plaid_item_unique").on(t.plaidItemId),
    pgPolicy("linked_accounts_rls_policy", {
      for: "all",
      to: "public",
      using: sql`${t.userId} = ${CURRENT_USER}`,
      withCheck: sql`${t.userId} = ${CURRENT_USER}`,
    }),
  ],
).enableRLS();

export const linkedTransactions = pgTable(
  "linked_transactions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    linkedAccountId: uuid("linked_account_id")
      .notNull()
      .references(() => linkedAccounts.id, { onDelete: "cascade" }),
    plaidTransactionId: text("plaid_transaction_id").notNull(),
    amount: numeric("amount", { precision: 14, scale: 4 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    vendor: text("vendor").notNull(),
    date: date("date").notNull(),
    pending: boolean("pending").notNull().default(false),
    // Set once the sync job decides this either created a new expense or
    // matched an existing manual one (see server/lib/dedupe.ts).
    expenseId: uuid("expense_id").references(() => expenses.id, { onDelete: "set null" }),
    dedupeStatus: varchar("dedupe_status", { length: 20 }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("linked_transactions_plaid_txn_unique").on(t.plaidTransactionId),
    index("linked_transactions_user_idx").on(t.userId),
    pgPolicy("linked_transactions_rls_policy", {
      for: "all",
      to: "public",
      using: sql`${t.userId} = ${CURRENT_USER}`,
      withCheck: sql`${t.userId} = ${CURRENT_USER}`,
    }),
  ],
).enableRLS();

export const auditActionEnum = pgEnum("audit_action", ["create", "update", "delete"]);
export const auditEntityEnum = pgEnum("audit_entity_type", ["expense", "loan", "savings_account", "asset", "income"]);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    entityType: auditEntityEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: auditActionEnum("action").notNull(),
    diff: jsonb("diff").notNull().$type<{ before: Record<string, unknown> | null; after: Record<string, unknown> | null }>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_user_entity_idx").on(t.userId, t.entityType, t.entityId),
    // Deliberately no update/delete policy: RLS default-denies any command
    // without a matching policy, so this log is append-only at the DB level
    // even for the app's own role — a bug can never let it edit history.
    pgPolicy("audit_log_select_policy", {
      for: "select",
      to: "public",
      using: sql`${t.userId} = ${CURRENT_USER}`,
    }),
    pgPolicy("audit_log_insert_policy", {
      for: "insert",
      to: "public",
      withCheck: sql`${t.userId} = ${CURRENT_USER}`,
    }),
    // A shared editor's writes to the owner's data must still be able to
    // write an audit entry keyed to the owner (writeAuditLog always logs
    // under the data's owner, not the actor) — without this, any mutation
    // made through a shared "edit" grant would fail outright on the log
    // insert alone, since the plain policy above only allows userId=self.
    pgPolicy("audit_log_shared_select_policy", {
      for: "select",
      to: "public",
      using: sql`EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = ${t.userId} AND account_shares.shared_with_user_id = ${CURRENT_USER} AND account_shares.status = 'accepted')`,
    }),
    pgPolicy("audit_log_shared_insert_policy", {
      for: "insert",
      to: "public",
      withCheck: sql`EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = ${t.userId} AND account_shares.shared_with_user_id = ${CURRENT_USER} AND account_shares.status = 'accepted' AND account_shares.permission = 'edit')`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Stage 4 — family/shared account visibility. Every business table above
// carries two extra RLS policies keyed off this table's rows, granting
// read (any accepted share) or read+write (accepted + "edit" permission) —
// see e.g. expenses_shared_select_policy / expenses_shared_write_policy.
// ---------------------------------------------------------------------------

export const sharePermissionEnum = pgEnum("share_permission", ["view", "edit"]);
export const shareStatusEnum = pgEnum("share_status", ["pending", "accepted"]);

export const accountShares = pgTable(
  "account_shares",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sharedWithUserId: uuid("shared_with_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    permission: sharePermissionEnum("permission").notNull().default("view"),
    status: shareStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("account_shares_owner_sharee_unique").on(t.ownerUserId, t.sharedWithUserId),
    index("account_shares_sharee_idx").on(t.sharedWithUserId),
    // Both parties can see the row (owner to manage it, sharee to see and
    // accept a pending invite); only the owner can create one; either party
    // can update (owner changes permission, sharee accepts) or delete (owner
    // revokes, sharee declines/leaves) — app-level checks narrow exactly
    // which fields each side may change beyond what RLS expresses here.
    pgPolicy("account_shares_select_policy", {
      for: "select",
      to: "public",
      using: sql`${t.ownerUserId} = ${CURRENT_USER} OR ${t.sharedWithUserId} = ${CURRENT_USER}`,
    }),
    pgPolicy("account_shares_insert_policy", {
      for: "insert",
      to: "public",
      withCheck: sql`${t.ownerUserId} = ${CURRENT_USER}`,
    }),
    pgPolicy("account_shares_update_policy", {
      for: "update",
      to: "public",
      using: sql`${t.ownerUserId} = ${CURRENT_USER} OR ${t.sharedWithUserId} = ${CURRENT_USER}`,
      withCheck: sql`${t.ownerUserId} = ${CURRENT_USER} OR ${t.sharedWithUserId} = ${CURRENT_USER}`,
    }),
    pgPolicy("account_shares_delete_policy", {
      for: "delete",
      to: "public",
      using: sql`${t.ownerUserId} = ${CURRENT_USER} OR ${t.sharedWithUserId} = ${CURRENT_USER}`,
    }),
  ],
).enableRLS();
