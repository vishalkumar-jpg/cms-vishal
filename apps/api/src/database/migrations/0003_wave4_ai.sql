CREATE TABLE IF NOT EXISTS "ob_cms"."ai_provider_keys" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"site_id" varchar(50) NOT NULL,
	"provider" varchar(20) NOT NULL,
	"label" varchar(120),
	"encrypted_key" varchar(2000) NOT NULL,
	"key_hint" varchar(40) NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "apk_site_provider_uq" UNIQUE("site_id","provider")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ob_cms"."ai_generation_jobs" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"site_id" varchar(50) NOT NULL,
	"prompt" varchar(8000) NOT NULL,
	"provider" varchar(20) NOT NULL,
	"model" varchar(80) NOT NULL,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"target_page_id" varchar(50),
	"result_layout" jsonb,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"cost_estimate_micro_usd" integer DEFAULT 0 NOT NULL,
	"error" varchar(2000)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."ai_provider_keys" ADD CONSTRAINT "ai_provider_keys_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."ai_generation_jobs" ADD CONSTRAINT "ai_generation_jobs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agj_site_status_idx" ON "ob_cms"."ai_generation_jobs" USING btree ("site_id","status");
