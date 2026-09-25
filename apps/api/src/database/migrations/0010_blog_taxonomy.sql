-- BLOG TAXONOMY — make post_terms.post_id nullable so the taxonomy manager can
-- create "standalone" categories/tags that exist independently of any post.
-- A NULL post_id row is a term definition; assigning it to a post creates a
-- normal (non-null) row. Idempotent: dropping a NOT NULL that's already dropped
-- is a no-op in Postgres.

ALTER TABLE "ob_cms"."post_terms" ALTER COLUMN "post_id" DROP NOT NULL;
