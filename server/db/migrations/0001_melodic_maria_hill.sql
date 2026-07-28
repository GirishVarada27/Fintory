CREATE TYPE "public"."notification_type" AS ENUM('budget_threshold', 'recurring_detected', 'loan_reminder');--> statement-breakpoint
CREATE TYPE "public"."recurring_status" AS ENUM('pending', 'confirmed', 'dismissed');--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"monthly_limit" numeric(14, 4) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"alert_threshold_pct" numeric(5, 2) DEFAULT '80' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budgets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "expense_splits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"expense_id" uuid NOT NULL,
	"category_id" uuid,
	"amount" numeric(14, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense_splits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fx_rates_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"base_currency" varchar(3) NOT NULL,
	"rates" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "recurring_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"vendor" text NOT NULL,
	"category_id" uuid,
	"average_amount" numeric(14, 4) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"cadence_days" integer NOT NULL,
	"last_seen_date" date NOT NULL,
	"status" "recurring_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recurring_expenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_splits" ADD CONSTRAINT "expense_splits_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "budgets_user_category_unique" ON "budgets" USING btree ("user_id","category_id");--> statement-breakpoint
CREATE INDEX "expense_splits_expense_idx" ON "expense_splits" USING btree ("expense_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_rates_history_date_base_unique" ON "fx_rates_history" USING btree ("date","base_currency");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_expenses_user_vendor_currency_unique" ON "recurring_expenses" USING btree ("user_id","vendor","currency");--> statement-breakpoint
CREATE POLICY "budgets_rls_policy" ON "budgets" AS PERMISSIVE FOR ALL TO public USING ("budgets"."user_id" = current_setting('app.current_user_id', true)::uuid) WITH CHECK ("budgets"."user_id" = current_setting('app.current_user_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "expense_splits_rls_policy" ON "expense_splits" AS PERMISSIVE FOR ALL TO public USING ("expense_splits"."user_id" = current_setting('app.current_user_id', true)::uuid) WITH CHECK ("expense_splits"."user_id" = current_setting('app.current_user_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "notifications_rls_policy" ON "notifications" AS PERMISSIVE FOR ALL TO public USING ("notifications"."user_id" = current_setting('app.current_user_id', true)::uuid) WITH CHECK ("notifications"."user_id" = current_setting('app.current_user_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "recurring_expenses_rls_policy" ON "recurring_expenses" AS PERMISSIVE FOR ALL TO public USING ("recurring_expenses"."user_id" = current_setting('app.current_user_id', true)::uuid) WITH CHECK ("recurring_expenses"."user_id" = current_setting('app.current_user_id', true)::uuid);--> statement-breakpoint
ALTER TABLE "budgets" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "expense_splits" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "recurring_expenses" FORCE ROW LEVEL SECURITY;