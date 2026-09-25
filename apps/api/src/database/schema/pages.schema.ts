import { sql } from "drizzle-orm";
import { index, jsonb, timestamp, unique, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";
import { systemUsers } from "./system-users.schema";

/**
 * `pages` (prefix `pag`) — a builder-authored page. The draft/publish model
 * (TECH-ARCHITECTURE §2.2): edits land in `draftLayout`; publish copies it to
 * `publishedLayout`, snapshots a `page_versions` row, and stamps `publishedAt`.
 *
 * - `status` ∈ draft | published | scheduled | archived.
 * - layouts are `SerializedLayout` (from @ob-cms/block-schema), validated on write.
 * - `seo` is { title, description, canonical, ogImage, noindex }.
 * - `parentId` self-FK builds the page tree (nav/breadcrumbs).
 * - UNIQUE(siteId, slug) — slugs are unique PER SITE.
 */
export const pages = obCmsSchema.table(
  "pages",
  {
    ...baseColumns("pag"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    title: varchar({ length: 300 }).notNull(),
    slug: varchar({ length: 200 }).notNull(),
    // i18n (B13). `locale` is this row's language; `translationKey` groups all
    // translations of one logical page (siblings share it, differ by locale).
    // Migration backfill sets locale=site.defaultLocale and translationKey=id so
    // every existing page is its own single-locale group — fully backward-compat.
    locale: varchar({ length: 12 }).notNull().default("en"),
    translationKey: varchar({ length: 50 }),
    status: varchar({ length: 20 }).notNull().default("draft"), // draft|published|scheduled|archived
    // B14 editorial workflow: draft → in_review → approved → published. A page is
    // published from `approved` (or directly by an editor+). reviewerId is the
    // assignee; reviewNote is the last approve/reject note.
    workflowState: varchar({ length: 20 }).notNull().default("draft"), // draft|in_review|approved|published
    reviewerId: varchar({ length: 50 }).references(() => systemUsers.id, { onDelete: "set null" }),
    reviewNote: varchar({ length: 1000 }),
    submittedAt: timestamp({ withTimezone: true }),
    reviewedAt: timestamp({ withTimezone: true }),
    draftLayout: jsonb(),
    publishedLayout: jsonb(),
    seo: jsonb().notNull().default({}),
    parentId: varchar({ length: 50 }),
    schemaVersion: varchar({ length: 20 }).notNull().default("2.0"),
    scheduledAt: timestamp({ withTimezone: true }),
    publishedAt: timestamp({ withTimezone: true }),
    // CONTENT-OPS: scheduled unpublish / expiry. When set and in the past, the
    // worker auto-unpublishes (status→draft, publishedLayout cleared from public
    // via cache purge). Cleared on manual publish unless re-set. Nullable → no
    // regression for existing rows.
    expiresAt: timestamp({ withTimezone: true }),
    // CONTENT-OPS: draft-preview links. Per-row random nonce; the shareable token
    // is HMAC(secret, `page:${id}:${nonce}`). Rotating/nulling this revokes every
    // previously-issued preview link. Null → no active preview link.
    previewToken: varchar({ length: 64 }),
    // Per-page chrome controls: inherit homepage topbar/navbar/footer by default
    // and optionally hide individual slots on this page.
    layoutOptions: jsonb().notNull().default({}),
    // Phase 3 template provenance — display-only snapshot from instantiate.
    // No FK: origin must survive skeleton archive/delete. Never writable via
    // CreatePageDto / UpdatePageDto; set only by TemplateInstantiationService.
    sourceTemplateId: varchar({ length: 50 }),
    sourceTemplateKey: varchar({ length: 100 }),
    sourceTemplateVersion: varchar({ length: 50 }),
    instantiatedAt: timestamp({ withTimezone: true }),
    /** Connection-scoped HubSpot import source identity (nullable for non-import content). */
    hubspotConnectionId: varchar({ length: 50 }),
    hubspotKind: varchar({ length: 20 }),
    hubspotHsId: varchar({ length: 64 }),
  },
  (t) => [
    // i18n: slugs are unique per (site, LOCALE) — the same logical slug can exist
    // in different locales (e.g. /about and /es/about). Single-locale sites are
    // unaffected (locale is constant per site).
    unique("pag_site_locale_slug_uq").on(t.siteId, t.locale, t.slug),
    index("pag_site_status_idx").on(t.siteId, t.status),
    // i18n: fetch a logical page's translations / resolve a (key, locale) sibling.
    index("pag_site_transkey_locale_idx").on(t.siteId, t.translationKey, t.locale),
    index("pag_parent_idx").on(t.parentId),
    // WAVE4b: admin "recent pages" lists.
    index("pag_site_updated_idx").on(t.siteId, t.updatedAt),
    // B14: review-queue filters (by workflow state / by assignee).
    index("pag_site_workflow_idx").on(t.siteId, t.workflowState),
    index("pag_site_reviewer_idx").on(t.siteId, t.reviewerId),
    // CONTENT-OPS: the expiry worker scans published rows with a due expiresAt.
    index("pag_site_expires_idx").on(t.siteId, t.expiresAt),
    uniqueIndex("pag_hubspot_source_active_uidx")
      .on(t.siteId, t.hubspotConnectionId, t.hubspotKind, t.hubspotHsId)
      .where(
        sql`deleted_at IS NULL AND hubspot_connection_id IS NOT NULL AND hubspot_kind IS NOT NULL AND hubspot_hs_id IS NOT NULL`,
      ),
  ],
);

export type PageRow = typeof pages.$inferSelect;
export type NewPageRow = typeof pages.$inferInsert;

/**
 * `pageVersions` (prefix `pvr`) — immutable publish/rollback snapshots. One row
 * per publish (or explicit snapshot), holding the full layout + seo so any prior
 * state can be restored via `POST /pages/:id/rollback/:versionId`.
 */
export const pageVersions = obCmsSchema.table(
  "page_versions",
  {
    ...baseColumns("pvr"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    pageId: varchar({ length: 50 })
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    snapshot: jsonb().notNull(),
    label: varchar({ length: 200 }),
    authorId: varchar({ length: 50 }).references(() => systemUsers.id, { onDelete: "set null" }),
  },
  (t) => [index("pvr_page_idx").on(t.pageId, t.createdAt)],
);

export type PageVersionRow = typeof pageVersions.$inferSelect;
export type NewPageVersionRow = typeof pageVersions.$inferInsert;
