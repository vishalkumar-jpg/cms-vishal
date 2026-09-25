CREATE SCHEMA IF NOT EXISTS "ob_cms";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ob_cms"."organizations" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"name" varchar(200) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"plan" jsonb DEFAULT '{"tier":"free","limits":{}}'::jsonb NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ob_cms"."system_users" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"email" varchar(320) NOT NULL,
	"password_hash" text,
	"name" varchar(200),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	CONSTRAINT "system_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ob_cms"."sites" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"org_id" varchar(50) NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"subdomain" varchar(120) NOT NULL,
	"custom_domain" varchar(255),
	"primary_domain" varchar(255),
	"owner_id" varchar(50),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"visibility" varchar(20) DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "sites_slug_unique" UNIQUE("slug"),
	CONSTRAINT "sites_subdomain_unique" UNIQUE("subdomain"),
	CONSTRAINT "sites_custom_domain_unique" UNIQUE("custom_domain")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ob_cms"."site_settings" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"site_id" varchar(50) NOT NULL,
	"tagline" varchar(300),
	"logo_url" varchar(500),
	"favicon_url" varchar(500),
	"primary_color" varchar(9) DEFAULT '#0066FF',
	"accent_color" varchar(9) DEFAULT '#FF6600',
	"heading_font" varchar(120) DEFAULT 'Inter',
	"body_font" varchar(120) DEFAULT 'Inter',
	"default_og_image_url" varchar(500),
	"contact_email" varchar(320),
	"contact_phone" varchar(50),
	"contact_address" varchar(500),
	"social_linkedin" varchar(500),
	"social_twitter" varchar(500),
	"social_facebook" varchar(500),
	"social_instagram" varchar(500),
	"ga4_tracking_id" varchar(50),
	"tawk_to_id" varchar(100),
	"forms_api_url" varchar(500),
	CONSTRAINT "site_settings_site_id_unique" UNIQUE("site_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ob_cms"."site_members" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"site_id" varchar(50),
	"user_id" varchar(50) NOT NULL,
	"role" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"invited_by" varchar(50),
	CONSTRAINT "mbr_site_user_uq" UNIQUE("site_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ob_cms"."site_domains" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"site_id" varchar(50) NOT NULL,
	"domain" varchar(255) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"ssl_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"verification_token" varchar(100) NOT NULL,
	"verified_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	CONSTRAINT "site_domains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ob_cms"."audit_log" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"site_id" varchar(50),
	"actor_id" varchar(50),
	"action" varchar(100) NOT NULL,
	"category" varchar(30),
	"entity_type" varchar(60),
	"entity_id" varchar(50),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ob_cms"."password_reset_tokens" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"user_id" varchar(50) NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."sites" ADD CONSTRAINT "sites_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "ob_cms"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."sites" ADD CONSTRAINT "sites_owner_id_system_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "ob_cms"."system_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."site_settings" ADD CONSTRAINT "site_settings_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."site_members" ADD CONSTRAINT "site_members_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."site_members" ADD CONSTRAINT "site_members_user_id_system_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ob_cms"."system_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."site_members" ADD CONSTRAINT "site_members_invited_by_system_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "ob_cms"."system_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."site_domains" ADD CONSTRAINT "site_domains_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."audit_log" ADD CONSTRAINT "audit_log_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."audit_log" ADD CONSTRAINT "audit_log_actor_id_system_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "ob_cms"."system_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_system_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "ob_cms"."system_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_slug_idx" ON "ob_cms"."organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usr_email_idx" ON "ob_cms"."system_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ste_org_idx" ON "ob_cms"."sites" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ste_subdomain_idx" ON "ob_cms"."sites" USING btree ("subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ste_custom_domain_idx" ON "ob_cms"."sites" USING btree ("custom_domain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ste_visibility_idx" ON "ob_cms"."sites" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mbr_user_idx" ON "ob_cms"."site_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mbr_site_idx" ON "ob_cms"."site_members" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dom_site_idx" ON "ob_cms"."site_domains" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aud_site_created_idx" ON "ob_cms"."audit_log" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aud_actor_created_idx" ON "ob_cms"."audit_log" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aud_entity_idx" ON "ob_cms"."audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prt_token_hash_idx" ON "ob_cms"."password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prt_user_idx" ON "ob_cms"."password_reset_tokens" USING btree ("user_id");
