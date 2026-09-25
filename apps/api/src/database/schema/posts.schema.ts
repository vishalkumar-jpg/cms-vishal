import { sql } from "drizzle-orm";
import { index, jsonb, timestamp, unique, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";
import { systemUsers } from "./system-users.schema";

/**
 * `posts` (prefix `pst`) — blog posts. Same draft/publish lifecycle as pages but
 * with a richtext/layout body, excerpt, cover media and an author.
 *
 * - `status` ∈ draft | published | scheduled | archived.
 * - `layout` is a `SerializedLayout` (builder) OR a richtext doc — validated when
 *   it looks like a layout.
 * - UNIQUE(siteId, slug).
 */
export const posts = obCmsSchema.table(
  "posts",
  {
    ...baseColumns("pst"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    title: varchar({ length: 300 }).notNull(),
    slug: varchar({ length: 200 }).notNull(),
    // i18n (B13) — mirrors pages: `locale` is this post's language and
    // `translationKey` groups translations of one logical post. Backfilled to
    // locale=site.defaultLocale, translationKey=id for existing rows.
    locale: varchar({ length: 12 }).notNull().default("en"),
    translationKey: varchar({ length: 50 }),
    status: varchar({ length: 20 }).notNull().default("draft"),
    // B14 editorial workflow (mirrors pages): draft → in_review → approved → published.
    workflowState: varchar({ length: 20 }).notNull().default("draft"), // draft|in_review|approved|published
    reviewerId: varchar({ length: 50 }).references(() => systemUsers.id, { onDelete: "set null" }),
    reviewNote: varchar({ length: 1000 }),
    submittedAt: timestamp({ withTimezone: true }),
    reviewedAt: timestamp({ withTimezone: true }),
    excerpt: varchar({ length: 600 }),
    layout: jsonb(),
    seo: jsonb().notNull().default({}),
    coverMediaId: varchar({ length: 50 }),
    authorId: varchar({ length: 50 }).references(() => systemUsers.id, { onDelete: "set null" }),
    publishedAt: timestamp({ withTimezone: true }),
    scheduledAt: timestamp({ withTimezone: true }),
    // CONTENT-OPS: scheduled unpublish / expiry (mirrors pages). When set and in
    // the past, the worker auto-unpublishes a published post. Cleared on manual
    // publish unless re-set. Nullable → no regression.
    expiresAt: timestamp({ withTimezone: true }),
    // CONTENT-OPS: draft-preview link nonce (mirrors pages). Token is
    // HMAC(secret, `post:${id}:${nonce}`); null/rotate revokes existing links.
    previewToken: varchar({ length: 64 }),
    /** Connection-scoped HubSpot import source identity (nullable for non-import content). */
    hubspotConnectionId: varchar({ length: 50 }),
    hubspotKind: varchar({ length: 20 }),
    hubspotHsId: varchar({ length: 64 }),
  },
  (t) => [
    // i18n: slugs are unique per (site, LOCALE).
    unique("pst_site_locale_slug_uq").on(t.siteId, t.locale, t.slug),
    index("pst_site_status_idx").on(t.siteId, t.status),
    index("pst_site_transkey_locale_idx").on(t.siteId, t.translationKey, t.locale),
    // WAVE4b: admin "recent posts" lists.
    index("pst_site_updated_idx").on(t.siteId, t.updatedAt),
    // B14: review-queue filters (by workflow state / by assignee).
    index("pst_site_workflow_idx").on(t.siteId, t.workflowState),
    index("pst_site_reviewer_idx").on(t.siteId, t.reviewerId),
    // CONTENT-OPS: the expiry worker scans published rows with a due expiresAt.
    index("pst_site_expires_idx").on(t.siteId, t.expiresAt),
    uniqueIndex("pst_hubspot_source_active_uidx")
      .on(t.siteId, t.hubspotConnectionId, t.hubspotKind, t.hubspotHsId)
      .where(
        sql`deleted_at IS NULL AND hubspot_connection_id IS NOT NULL AND hubspot_kind IS NOT NULL AND hubspot_hs_id IS NOT NULL`,
      ),
  ],
);

export type PostRow = typeof posts.$inferSelect;
export type NewPostRow = typeof posts.$inferInsert;

/**
 * `postTerms` (prefix `ptm`) — categories/tags attached to a post. `kind`
 * distinguishes category vs tag; `slug` is unique per (site, kind, post slug-set)
 * — we keep it simple: UNIQUE(siteId, postId, kind, slug).
 */
export const postTerms = obCmsSchema.table(
  "post_terms",
  {
    ...baseColumns("ptm"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    // Nullable: a NULL postId is a "standalone" term created in the taxonomy
    // manager that exists independently of any post (see BlogService.createTerm).
    postId: varchar({ length: 50 }).references(() => posts.id, { onDelete: "cascade" }),
    kind: varchar({ length: 20 }).notNull(), // category | tag
    name: varchar({ length: 120 }).notNull(),
    slug: varchar({ length: 140 }).notNull(),
  },
  (t) => [
    unique("ptm_post_kind_slug_uq").on(t.postId, t.kind, t.slug),
    index("ptm_site_kind_idx").on(t.siteId, t.kind),
  ],
);

export type PostTermRow = typeof postTerms.$inferSelect;
export type NewPostTermRow = typeof postTerms.$inferInsert;
