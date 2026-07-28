CREATE TYPE "public"."expense_source" AS ENUM('manual', 'scanned');--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" varchar(50),
	"currency" varchar(3) NOT NULL,
	"current_value" numeric(14, 4) NOT NULL,
	"purchase_price" numeric(14, 4),
	"purchase_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"color" varchar(7),
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" numeric(14, 4) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"category_id" uuid,
	"vendor" text NOT NULL,
	"date" date NOT NULL,
	"source" "expense_source" DEFAULT 'manual' NOT NULL,
	"receipt_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lender" text NOT NULL,
	"type" varchar(50),
	"principal" numeric(14, 4) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"apr" numeric(6, 3) NOT NULL,
	"term_months" integer NOT NULL,
	"monthly_payment" numeric(14, 4) NOT NULL,
	"start_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "savings_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"institution" text,
	"type" varchar(50),
	"currency" varchar(3) NOT NULL,
	"balance" numeric(14, 4) DEFAULT '0' NOT NULL,
	"target_amount" numeric(14, 4),
	"apy" numeric(6, 3),
	"monthly_contribution" numeric(14, 4) DEFAULT '0',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "savings_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"default_display_currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_accounts" ADD CONSTRAINT "savings_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_user_idx" ON "assets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_user_name_unique" ON "categories" USING btree ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_global_name_unique" ON "categories" USING btree ("name") WHERE "categories"."user_id" IS NULL;--> statement-breakpoint
CREATE INDEX "expenses_user_date_idx" ON "expenses" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "loans_user_idx" ON "loans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "savings_accounts_user_idx" ON "savings_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "assets_rls_policy" ON "assets" AS PERMISSIVE FOR ALL TO public USING ("assets"."user_id" = current_setting('app.current_user_id', true)::uuid) WITH CHECK ("assets"."user_id" = current_setting('app.current_user_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "categories_select_policy" ON "categories" AS PERMISSIVE FOR SELECT TO public USING ("categories"."user_id" IS NULL OR "categories"."user_id" = current_setting('app.current_user_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "categories_insert_policy" ON "categories" AS PERMISSIVE FOR INSERT TO public WITH CHECK ("categories"."user_id" = current_setting('app.current_user_id', true)::uuid OR ("categories"."user_id" IS NULL AND current_setting('app.current_user_id', true)::uuid IS NULL));--> statement-breakpoint
CREATE POLICY "categories_update_policy" ON "categories" AS PERMISSIVE FOR UPDATE TO public USING ("categories"."user_id" = current_setting('app.current_user_id', true)::uuid OR ("categories"."user_id" IS NULL AND current_setting('app.current_user_id', true)::uuid IS NULL)) WITH CHECK ("categories"."user_id" = current_setting('app.current_user_id', true)::uuid OR ("categories"."user_id" IS NULL AND current_setting('app.current_user_id', true)::uuid IS NULL));--> statement-breakpoint
CREATE POLICY "categories_delete_policy" ON "categories" AS PERMISSIVE FOR DELETE TO public USING ("categories"."user_id" = current_setting('app.current_user_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "expenses_rls_policy" ON "expenses" AS PERMISSIVE FOR ALL TO public USING ("expenses"."user_id" = current_setting('app.current_user_id', true)::uuid) WITH CHECK ("expenses"."user_id" = current_setting('app.current_user_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "loans_rls_policy" ON "loans" AS PERMISSIVE FOR ALL TO public USING ("loans"."user_id" = current_setting('app.current_user_id', true)::uuid) WITH CHECK ("loans"."user_id" = current_setting('app.current_user_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "savings_accounts_rls_policy" ON "savings_accounts" AS PERMISSIVE FOR ALL TO public USING ("savings_accounts"."user_id" = current_setting('app.current_user_id', true)::uuid) WITH CHECK ("savings_accounts"."user_id" = current_setting('app.current_user_id', true)::uuid);--> statement-breakpoint
-- Postgres skips RLS policies for the table owner unless FORCE is set. The
-- app connects as the same role that owns these tables (single-role setup),
-- so without FORCE, RLS would silently do nothing for our own connections.
ALTER TABLE "assets" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "categories" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "expenses" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "loans" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "savings_accounts" FORCE ROW LEVEL SECURITY;