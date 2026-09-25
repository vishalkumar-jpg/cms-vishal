-- ONSITE-SEARCH (#64) — public, site-scoped Postgres full-text search over the
-- PUBLISHED content of pages, blog posts and collection items.
--
-- We use EXPRESSION-based GIN indexes (not stored/generated tsvector columns):
--   * the searchable text spans plain columns (title/slug/excerpt) AND jsonb
--     (`seo`, `data`, `published_layout`/`layout`), and building a stable
--     GENERATED tsvector over jsonb needs IMMUTABLE extraction wrappers;
--   * an expression index over `to_tsvector('english', <same expr the query
--     builds>)` keeps the Drizzle table definitions untouched (no snapshot
--     regen) while still letting the planner use the GIN index for `@@`.
--
-- The indexed document per row (must match SearchService.docExpr):
--   pages           : title + slug + seo::text + published_layout::text
--   posts           : title + slug + excerpt + seo::text + layout::text
--   collection_items: slug + data::text
--
-- Partial indexes (published + not-deleted) keep them small and hot. Every
-- statement is IF NOT EXISTS / duplicate-safe (re-applying is a no-op).

CREATE INDEX IF NOT EXISTS "pag_fts_idx"
  ON "ob_cms"."pages"
  USING gin (to_tsvector('english',
    coalesce("title", '') || ' ' ||
    coalesce("slug", '') || ' ' ||
    coalesce("seo"::text, '') || ' ' ||
    coalesce("published_layout"::text, '')))
  WHERE "status" = 'published' AND "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pst_fts_idx"
  ON "ob_cms"."posts"
  USING gin (to_tsvector('english',
    coalesce("title", '') || ' ' ||
    coalesce("slug", '') || ' ' ||
    coalesce("excerpt", '') || ' ' ||
    coalesce("seo"::text, '') || ' ' ||
    coalesce("layout"::text, '')))
  WHERE "status" = 'published' AND "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cit_fts_idx"
  ON "ob_cms"."collection_items"
  USING gin (to_tsvector('english',
    coalesce("slug", '') || ' ' ||
    coalesce("data"::text, '')))
  WHERE "status" = 'published' AND "deleted_at" IS NULL;
