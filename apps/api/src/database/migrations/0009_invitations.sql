-- INVITATIONS — invite teammates by EMAIL (governance).
--
-- `site_invitations` backs the "invite by email" flow: a site_admin creates a
-- pending invite, an email with a unique-token accept link is sent, and on
-- accept we attach (or create + attach) the user as a site_members row with the
-- invited role. Tenant-private (site_id NOT NULL). IF NOT EXISTS so re-applying
-- is a no-op and an existing DB is upgraded in place.

CREATE TABLE IF NOT EXISTS "ob_cms"."site_invitations" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" varchar(50),
	"updated_by" varchar(50),
	"site_id" varchar(50) NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" varchar(20) NOT NULL,
	"token" varchar(128) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"invited_by" varchar(50),
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	CONSTRAINT "inv_token_uq" UNIQUE("token")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."site_invitations" ADD CONSTRAINT "site_invitations_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "ob_cms"."sites"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ob_cms"."site_invitations" ADD CONSTRAINT "site_invitations_invited_by_system_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "ob_cms"."system_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inv_site_status_idx" ON "ob_cms"."site_invitations" USING btree ("site_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inv_email_idx" ON "ob_cms"."site_invitations" USING btree ("email");
