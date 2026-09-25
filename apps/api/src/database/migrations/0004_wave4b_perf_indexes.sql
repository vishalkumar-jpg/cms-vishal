-- WAVE4b — performance indexes for hot tenant queries.
--
-- The core (site_id, status) composites already exist for pages/posts/forms.
-- These fill remaining gaps observed on admin-list and worker-sweep paths. All
-- are IF NOT EXISTS so re-applying is a no-op and this never conflicts with the
-- drizzle-managed indexes from earlier waves.

-- Admin "recent pages/posts" lists order by updated_at within a site.
CREATE INDEX IF NOT EXISTS "pag_site_updated_idx"
  ON "ob_cms"."pages" USING btree ("site_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pst_site_updated_idx"
  ON "ob_cms"."posts" USING btree ("site_id","updated_at");--> statement-breakpoint

-- CRM sweeper scans stuck submissions per-site by status+age; widen the
-- existing (site_id,form_id,created_at) coverage with a status-leading index.
CREATE INDEX IF NOT EXISTS "fsb_site_status_created_idx"
  ON "ob_cms"."form_submissions" USING btree ("site_id","status","created_at");--> statement-breakpoint

-- Membership lookups by (user, site) back every TenantGuard check; the unique
-- (site_id,user_id) already serves site-scoped reads, this serves the user's
-- "my sites" fan-out ordered deterministically.
CREATE INDEX IF NOT EXISTS "mbr_user_site_idx"
  ON "ob_cms"."site_members" USING btree ("user_id","site_id");--> statement-breakpoint

-- Redirect resolution on the public path is keyed by (site_id, from_path); the
-- existing unique constraint covers it, but add the explicit lookup index for
-- the host-resolved hot path where only site_id is filtered first.
CREATE INDEX IF NOT EXISTS "rdr_site_from_idx"
  ON "ob_cms"."redirects" USING btree ("site_id","from_path");
