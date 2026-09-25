-- PHASE 3 — Identity & audiences. The B2B intelligence layer over the Phase-2
-- analytics stream: visitor profiles (aggregated per visitorId), identities
-- (by email), companies (by email domain), scoring rules, and audience
-- definitions/memberships. All tenant-private (site_id FK, cascade on site
-- delete). Every statement is IF NOT EXISTS / duplicate-safe (re-applying is a
-- no-op).

-- 1. companies (B2B account by email domain).
CREATE TABLE IF NOT EXISTS "ob_cms"."companies" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "domain" varchar(255) NOT NULL,
  "name" varchar(255),
  "industry" varchar(120),
  "size" varchar(40)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."companies"
    ADD CONSTRAINT "companies_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cmp_site_domain_uidx" ON "ob_cms"."companies" USING btree ("site_id","domain");
--> statement-breakpoint

-- 2. identities (a known person, by primary_email).
CREATE TABLE IF NOT EXISTS "ob_cms"."identities" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "primary_email" varchar(320) NOT NULL,
  "name" varchar(255),
  "company_id" varchar(50)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."identities"
    ADD CONSTRAINT "identities_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."identities"
    ADD CONSTRAINT "identities_company_id_companies_id_fk"
    FOREIGN KEY ("company_id") REFERENCES "ob_cms"."companies"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idt_site_email_uidx" ON "ob_cms"."identities" USING btree ("site_id","primary_email");
--> statement-breakpoint

-- 3. visitor_profiles (aggregated per visitor_id).
CREATE TABLE IF NOT EXISTS "ob_cms"."visitor_profiles" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "visitor_id" varchar(60) NOT NULL,
  "first_seen" timestamp with time zone,
  "last_seen" timestamp with time zone,
  "sessions" integer DEFAULT 0 NOT NULL,
  "pageviews" integer DEFAULT 0 NOT NULL,
  "last_source" varchar(20),
  "last_device" varchar(10),
  "top_paths" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "identity_id" varchar(50),
  "score" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."visitor_profiles"
    ADD CONSTRAINT "visitor_profiles_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."visitor_profiles"
    ADD CONSTRAINT "visitor_profiles_identity_id_identities_id_fk"
    FOREIGN KEY ("identity_id") REFERENCES "ob_cms"."identities"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vpr_site_visitor_uidx" ON "ob_cms"."visitor_profiles" USING btree ("site_id","visitor_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vpr_site_score_idx" ON "ob_cms"."visitor_profiles" USING btree ("site_id","score");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vpr_site_lastseen_idx" ON "ob_cms"."visitor_profiles" USING btree ("site_id","last_seen");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vpr_site_identity_idx" ON "ob_cms"."visitor_profiles" USING btree ("site_id","identity_id");
--> statement-breakpoint

-- 4. scoring_rules (admin-defined lead scoring).
CREATE TABLE IF NOT EXISTS "ob_cms"."scoring_rules" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "name" varchar(200) NOT NULL,
  "condition" jsonb NOT NULL,
  "points" integer DEFAULT 0 NOT NULL,
  "active" varchar(5) DEFAULT 'true' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."scoring_rules"
    ADD CONSTRAINT "scoring_rules_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scr_site_idx" ON "ob_cms"."scoring_rules" USING btree ("site_id");
--> statement-breakpoint

-- 5. audience_definitions (a condition group over profile/identity fields).
CREATE TABLE IF NOT EXISTS "ob_cms"."audience_definitions" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "name" varchar(200) NOT NULL,
  "description" varchar(500),
  "rules" jsonb NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."audience_definitions"
    ADD CONSTRAINT "audience_definitions_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aud_site_idx" ON "ob_cms"."audience_definitions" USING btree ("site_id");
--> statement-breakpoint

-- 6. audience_memberships (materialized membership rows).
CREATE TABLE IF NOT EXISTS "ob_cms"."audience_memberships" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" varchar(50),
  "updated_by" varchar(50),
  "site_id" varchar(50) NOT NULL,
  "audience_id" varchar(50) NOT NULL,
  "visitor_profile_id" varchar(50) NOT NULL,
  "visitor_id" varchar(60) NOT NULL,
  "identity_id" varchar(50)
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."audience_memberships"
    ADD CONSTRAINT "audience_memberships_site_id_sites_id_fk"
    FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ob_cms"."audience_memberships"
    ADD CONSTRAINT "audience_memberships_audience_id_audience_definitions_id_fk"
    FOREIGN KEY ("audience_id") REFERENCES "ob_cms"."audience_definitions"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ame_audience_profile_uidx" ON "ob_cms"."audience_memberships" USING btree ("audience_id","visitor_profile_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ame_site_audience_idx" ON "ob_cms"."audience_memberships" USING btree ("site_id","audience_id");
