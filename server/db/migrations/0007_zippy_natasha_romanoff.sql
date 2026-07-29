CREATE TABLE "income" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" numeric(14, 4) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"source" text NOT NULL,
	"date" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "income" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "income" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "income" ADD CONSTRAINT "income_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "income_user_date_idx" ON "income" USING btree ("user_id","date");--> statement-breakpoint
CREATE POLICY "income_rls_policy" ON "income" AS PERMISSIVE FOR ALL TO public USING ("income"."user_id" = current_setting('app.current_user_id', true)::uuid) WITH CHECK ("income"."user_id" = current_setting('app.current_user_id', true)::uuid);--> statement-breakpoint
CREATE POLICY "income_shared_select_policy" ON "income" AS PERMISSIVE FOR SELECT TO public USING (EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = "income"."user_id" AND account_shares.shared_with_user_id = current_setting('app.current_user_id', true)::uuid AND account_shares.status = 'accepted'));--> statement-breakpoint
CREATE POLICY "income_shared_write_policy" ON "income" AS PERMISSIVE FOR ALL TO public USING (EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = "income"."user_id" AND account_shares.shared_with_user_id = current_setting('app.current_user_id', true)::uuid AND account_shares.status = 'accepted' AND account_shares.permission = 'edit')) WITH CHECK (EXISTS (SELECT 1 FROM account_shares WHERE account_shares.owner_user_id = "income"."user_id" AND account_shares.shared_with_user_id = current_setting('app.current_user_id', true)::uuid AND account_shares.status = 'accepted' AND account_shares.permission = 'edit'));