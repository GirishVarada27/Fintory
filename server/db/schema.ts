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
  ],
).enableRLS();

export const expenseSourceEnum = pgEnum("expense_source", ["manual", "scanned"]);

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
  ],
).enableRLS();
