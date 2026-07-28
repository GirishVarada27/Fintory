CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete');--> statement-breakpoint
CREATE TYPE "public"."audit_entity_type" AS ENUM('expense', 'loan', 'savings_account', 'asset');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_type" "audit_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" "audit_action" NOT NULL,
	"diff" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "linked_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plaid_item_id" text NOT NULL,
	"encrypted_access_token" text NOT NULL,
	"institution_name" text NOT NULL,
	"account_name" text NOT NULL,
	"account_type" varchar(50),
	"mask" varchar(8),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "linked_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "linked_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"linked_account_id" uuid NOT NULL,
	"plaid_transaction_id" text NOT NULL,
	"amount" numeric(14, 4) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"vendor" text NOT NULL,
	"date" date NOT NULL,
	"pending" boolean DEFAULT false NOT NULL,
	"expense_id" uuid,
	"dedupe_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "linked_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linked_accounts" ADD CONSTRAINT "linked_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linked_transactions" ADD CONSTRAINT "linked_transactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linked_transactions" ADD CONSTRAINT "linked_transactions_linked_account_id_linked_accounts_id_fk" FOREIGN KEY ("linked_account_id") REFERENCES "public"."linked_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linked_transactions" ADD CONSTRAINT "linked_transactions_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_user_entity_idx" ON "audit_log" USING btree ("user_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "linked_accounts_plaid_item_unique" ON "linked_accounts" USING btree ("plaid_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "linked_transactions_plaid_txn_unique" ON "linked_transactions" USING btree ("plaid_transaction_id");--> statement-breakpoint
CREATE INDEX "linked_transactions_user_idx" ON "linked_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "audit_log_select_policy" ON "audit_log" AS PERMISSIVE FOR SELECT TO public USING ("audit_log"."user_id" = current_setting('app.current_user_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "audit_log_insert_policy" ON "audit_log" AS PERMISSIVE FOR INSERT TO public WITH CHECK ("audit_log"."user_id" = current_setting('app.current_user_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "linked_accounts_rls_policy" ON "linked_accounts" AS PERMISSIVE FOR ALL TO public USING ("linked_accounts"."user_id" = current_setting('app.current_user_id', true)::uuid) WITH CHECK ("linked_accounts"."user_id" = current_setting('app.current_user_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "linked_transactions_rls_policy" ON "linked_transactions" AS PERMISSIVE FOR ALL TO public USING ("linked_transactions"."user_id" = current_setting('app.current_user_id', true)::uuid) WITH CHECK ("linked_transactions"."user_id" = current_setting('app.current_user_id', true)::uuid);--> statement-breakpoint
ALTER TABLE "audit_log" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "linked_accounts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "linked_transactions" FORCE ROW LEVEL SECURITY;