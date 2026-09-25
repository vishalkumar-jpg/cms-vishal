# Starter Templates (Template Catalog API)

Admin product name: **Starter Templates**. API/module name remains
`template-catalog` (read-only **browse projection** over platform template
skeletons). The gallery exposes metadata (and optional preview asset summaries)
without layout or section JSON in list responses.

**Not site-scoped** — same platform-global skeleton rows as
[template skeleton storage](./template-skeleton-storage.md). Reads require a
site membership (`X-Site-Id` + contributor role); platform admins may read
without a site header. There is no write API — create/update/delete stay on
`/api/v1/template-skeletons`.

**Related:** [Template skeleton storage](./template-skeleton-storage.md) ·
[Template skeleton preview assets](./template-skeleton-assets.md) ·
[Starter page templates](./starter-page-templates.md) ·
[Template architecture](./template-architecture.md)

---

## 1. Projection model

No separate catalog tables. `TemplateCatalogRepository` reads
`template_skeletons` (+ optional `template_skeleton_assets`) and maps rows to
`TemplateCatalogEntry` from `@ob-cms/template-registry` (`catalog-schema.ts`).

| Included | Omitted (fetch via skeletons) |
| --- | --- |
| `id`, `templateKey`, `displayName`, `description` | `layout` |
| `category`, `tags`, `supportedPageTypes` | `sections` |
| `version`, `status` | `pageStructure` |
| Flattened `featured`, `thumbnail`, `owner` from `previewMetadata` | `componentProps` |
| Optional `previewAssets` summaries when `includeAssets=true` | Full asset CRUD fields |

Thumbnail precedence: prefer `previewMetadata.thumbnail` when set, else the
skeleton’s singleton `thumbnail` asset URL; entries that fail catalog URL/schema
validation are omitted from results.

Invalid projections (empty `supportedPageTypes`, schema failures) are dropped
from list results rather than returned as partial entries.

Listing is hard-capped at 500 rows (same as skeleton list; pagination deferred).

---

## 2. API — `src/modules/template-catalog/`

Module: `TemplateCatalogModule` (registered in `app.module.ts`, Phase 2D).

| method | path | auth | purpose |
| --- | --- | --- | --- |
| GET | `/api/v1/template-catalog` | contributor | list with browse filters |
| GET | `/api/v1/template-catalog/by-key/:templateKey` | contributor | fetch by stable registry key |
| GET | `/api/v1/template-catalog/:id` | contributor | fetch by internal id |

### List query parameters

Validated by `parseTemplateCatalogQuery` in the service (DTO is Swagger-facing):

| param | notes |
| --- | --- |
| `category` | `marketing \| content \| legal \| utility \| campaign` |
| `status` | `draft \| published \| archived` |
| `pageType` | Match a supported page-type id |
| `tags` | AND match — entry must include all listed tags |
| `query` | Free-text over template key, display name, description |
| `featured` | Filter by `previewMetadata.featured` |
| `includeAssets` | Default `false`; when `true`, include preview asset summaries |
| `sort` | `displayName` (default), `updatedAt`, or `featured` |

OpenAPI tag: `template-catalog`.

---

## 3. Storage abstraction

`TemplateCatalogRepository` implements `TemplateCatalogStorage` from
`@ob-cms/template-registry`, injected via the `TEMPLATE_CATALOG_STORAGE` token.

Distinct from the in-memory builtin seed list in `catalog.ts`
(`BUILTIN_TEMPLATE_SEEDS`) — that list is metadata-only for the registry package
and is **not** what `db:seed` writes. Database rows come from Phase 2E (below).
As of PR #59, `catalog.ts` is kept in sync with
`BUILTIN_SKELETON_SEED_DEFS` (parity tests enforce this).

---

## 4. Builtin seed (Phase 2E / PR #59)

`bun run db:seed` idempotently inserts published Starter Template skeletons via
`apps/api/src/database/seed/template-skeletons.seed.ts` (+
`starter-layouts.ts`). **28 starters** ship at version **`1.4.0`**.

| templateKey | displayName | Featured |
| --- | --- | --- |
| `tpl-blank` | Blank Page | |
| `tpl-saas-landing` | SaaS Landing | yes |
| `tpl-marketing-hero` | Marketing Hero | yes |
| `tpl-portfolio` | Portfolio | |
| `tpl-contact` | Contact Page | yes |
| `tpl-about` | About | |
| `tpl-landing` | Landing Page | yes |
| `tpl-thank-you` | Thank You Page | |
| `tpl-404` | 404 Page | |
| `tpl-privacy-policy` | Privacy Policy | |
| `tpl-terms` | Terms & Conditions | |
| `tpl-generic-content` | Generic Content Page | |
| `tpl-homepage` | Homepage | yes |
| `tpl-services` | Services | yes |
| `tpl-service-detail` | Service Detail | yes |
| `tpl-industry-detail` | Industry Detail | |
| `tpl-pricing` | Pricing | yes |
| `tpl-team` | Team | |
| `tpl-careers` | Careers | |
| `tpl-faq` | FAQ | |
| `tpl-features` | Features | |
| `tpl-testimonials` | Testimonials | |
| `tpl-product-landing` | Product Landing | yes |
| `tpl-case-study` | Case Study | |
| `tpl-blog-listing` | Blog Home | |
| `tpl-blog-detail` | Blog Post | |
| `tpl-resource-listing` | Resource Listing | |
| `tpl-resource-detail` | Resource Detail | |

- Idempotency key: `templateKey` (skip if an active row exists at the same or newer version).
- Content: usable multi-section Craft layouts (hero / features / prose / form as
  appropriate) + one required section definition.
- Thumbnails: admin-served SVGs under `/templates/previews/{templateKey}-thumb.svg`
  (cover: `{templateKey}-cover.svg`). Generate via `node scripts/generate-template-preview-svgs.mjs`.
- Version: **`1.4.0`** (PR #59). Re-running seed refreshes layout + metadata when the seed version advances.

---

## 5. Page instantiation (Phase 2C-b)

`POST /api/v1/pages/from-template` creates a site-scoped draft page from one
published skeleton, identified by exactly one of `skeletonId` or `templateKey`.
The request also supplies the new page `title`, `slug`, and optional `parentId`
and SEO fields. It requires contributor membership for the active `X-Site-Id`.

`TemplateInstantiationService` resolves the skeleton, enforces published status,
and runs its layout through the block-schema deserialize/migrate/repair pass.
It then delegates generic page validation and persistence to `PagesService`.
The resulting page owns a separate JSON layout copy: later page edits never
write to or otherwise change the source skeleton.

Only `content.layout` maps to the current page model. Skeleton `sections`,
`pageStructure`, and `componentProps` remain definition metadata; pages have no
corresponding storage fields. Instantiation records a
`page.created_from_template` audit event and persists display-only provenance on
the page row (Phase 3).

---

## 6. Admin create-from-template (Phase 2C-c)

The admin **Starter Templates** gallery offers **Use Starter Template** on published
cards (plus a read-only overflow menu: Preview, Use Starter Template, Copy key/ID). Client-side filters search **display name, template key, description,
and tags** (plus category chips). The Use dialog collects title + slug (slug
auto-fills from the title until the user edits it; validation matches API page
slug/title rules including reserved root slugs), then calls
`POST /api/v1/pages/from-template` with the card’s `skeletonId`. On success the UI
invalidates the pages list and navigates to `/pages/:pageId/builder`. Draft and
archived starters show a disabled CTA with helper copy. Load failures offer a
**Retry** control.

---

## 6b. Template preview modal (Phase 2C-f)

Every catalog card offers **Preview**, which opens a read-only dialog showing
thumbnail, display name, description, category, tags, status, and version from
the existing catalog list payload (no extra fetch, no layout/Craft preview).
Copy states that the preview is **metadata-only**. Published templates can
continue to **Use Starter Template** from the preview dialog; draft and archived
templates keep that CTA disabled with the same helper copy as the card. Cards
use description fallbacks, title truncation, and thumbnail/error placeholders.

---

## 7. Template provenance (Phase 3)

When a page is created from a template, the page row stores a display-only
origin snapshot:

| Column | Meaning |
| --- | --- |
| `sourceTemplateId` | Skeleton id at instantiate time |
| `sourceTemplateKey` | Stable registry key (`tpl-…`) |
| `sourceTemplateVersion` | Skeleton `version` string at instantiate time |
| `instantiatedAt` | Timestamp of instantiation |

There is no foreign key and no live link to the skeleton. Editing or publishing
the page never updates the source template. Duplicate and translation copy the
same provenance; blank page create leaves all four fields `NULL`. Create/Update
page DTOs do not accept provenance writes.

The Builder shows a read-only badge (template key + version). There is no
“View Template”, sync, or update-from-template flow in this phase.

---

## 8. Two template systems (product naming)

These remain **intentionally separate**:

| Product name | Meaning | Surface |
| --- | --- | --- |
| **Starter Templates** | Platform-provided starting points for new pages | Admin → Starter Templates; `GET /api/v1/template-catalog`; `POST /api/v1/pages/from-template` |
| **My Templates** | Layouts saved from pages in the current site | Builder → My Templates; Save as My Template; `/api/v1/templates` |

Helper copy in both surfaces explains the difference. Seed inserts **28**
published starters with usable layouts and `/templates/previews/*.svg`
thumbnails (admin `public/`). Re-running seed refreshes rows when the bundled
version advances (see §4).

---

## 9. Out of scope (later phases)

- Live layout / Craft canvas preview
- Orval/SDK regeneration for admin clients
- Coming Soon / Maintenance / Login / Signup starter templates (deferred)
- View Template navigation / catalog deep-link
- Template sync / update-from-template / layout overwrite
- Pagination beyond the 500-row cap
- Parent selector / SEO fields on the Use Template dialog
- Merging platform starters with site-scoped My Templates
- Starter Template CRUD / platform template editing
