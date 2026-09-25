CREATE TABLE IF NOT EXISTS "ob_cms"."forms" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"site_id" varchar(50) NOT NULL,
	"name" varchar(200) NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"crm_mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "frm_site_name_uq" UNIQUE("site_id","name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ob_cms"."form_submissions" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"site_id" varchar(50) NOT NULL,
	"form_id" varchar(50) NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'stored' NOT NULL,
	"delivery_attempts" integer DEFAULT 0 NOT NULL,
	"last_error" varchar(1000),
	"delivered_at" timestamp with time zone,
	"idempotency_key" varchar(60),
	"is_spam" boolean DEFAULT false NOT NULL,
	CONSTRAINT "fsb_idempotency_uq" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ob_cms"."mock_crm_receipts" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"site_id" varchar(50),
	"form_id" varchar(50),
	"submission_id" varchar(50),
	"idempotency_key" varchar(60),
	"signature_valid" boolean DEFAULT false NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ob_cms"."site_settings" ADD COLUMN IF NOT EXISTS "crm_webhook_url" varchar(1000);--> statement-breakpoint
ALTER TABLE "ob_cms"."site_settings" ADD COLUMN IF NOT EXISTS "crm_hmac_secret" varchar(200);--> statement-breakpoint
ALTER TABLE "ob_cms"."site_settings" ADD COLUMN IF NOT EXISTS "crm_dual_write" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ob_cms"."site_settings" ADD COLUMN IF NOT EXISTS "crm_legacy_url" varchar(1000);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."forms" ADD CONSTRAINT "forms_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."form_submissions" ADD CONSTRAINT "form_submissions_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."form_submissions" ADD CONSTRAINT "form_submissions_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "ob_cms"."forms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "frm_site_status_idx" ON "ob_cms"."forms" USING btree ("site_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fsb_site_form_idx" ON "ob_cms"."form_submissions" USING btree ("site_id","form_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fsb_status_idx" ON "ob_cms"."form_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mcr_submission_idx" ON "ob_cms"."mock_crm_receipts" USING btree ("submission_id");
