# Template Skeleton Storage

Platform-level catalog rows for starter page templates. A **template skeleton**
stores catalog metadata separately from the editable layout/content payload used
when copying structure into a page.

**Not site-scoped** — global platform starters. Reads require a site membership
(`X-Site-Id` + contributor role); writes require platform admin.

**Related:** [Template skeleton preview assets](./template-skeleton-assets.md) ·
[Template catalog](./template-catalog.md) ·
[Template architecture](./template-architecture.md) ·
[Starter page templates](./starter-page-templates.md)

---

## 1. Data model

Migrations: `0037_template_skeletons.sql` (journal idx 37),
`0038_template_skeleton_assets.sql` (journal idx 38).

Schema: `apps/api/src/database/schema/template-skeletons.schema.ts` (exported
via the schema barrel).

### `template_skeletons` (prefix `tsk`)

| column | type | notes |
| --- | --- | --- |
| baseColumns | — | KSUID id + timestamps + soft delete + actor ids |
| `templateKey` | varchar(100) | Stable registry id (`tpl-homepage`, …); unique among active rows |
| `displayName` | varchar(200) | UI label |
| `description` | text | Catalog blurb |
| `category` | varchar(50) | `marketing \| content \| legal \| utility \| campaign` |
| `tags` | jsonb | string[] search facets |
| `supportedPageTypes` | jsonb | string[] logical page-type tags |
| `previewMetadata` | jsonb | `{ thumbnail?, featured?, owner? }` |
| `version` | varchar(50) | Semver-like revision of the published skeleton |
| `status` | varchar(20) | `draft \| published \| archived` |
| `schemaVersion` | varchar(20) | Metadata-row compatibility stamp |

### `template_skeleton_contents` (prefix `tsc`)

One active content row per skeleton (1:1). Holds the builder layout tree and
logical section definitions.

| column | type | notes |
| --- | --- | --- |
| `skeletonId` | varchar(50) | FK → `template_skeletons`, cascade delete |
| `layout` | jsonb | Serialized block tree (`@ob-cms/block-schema`) |
| `sections` | jsonb | Logical section slots (not Craft nodes) |
| `pageStructure` | jsonb | Required/optional section ids + default order |
| `componentProps` | jsonb | Default props map |
| `contentSchemaVersion` | varchar(20) | Content-payload compatibility stamp |

Validation for create/update payloads lives in `@ob-cms/template-registry`
(`skeleton-schema.ts`). Layout JSON is normalized through `deserializeLayout`
at the service boundary.

---

## 2. API — `src/modules/template-skeletons/`

Module: `TemplateSkeletonsModule` (registered in `app.module.ts`).

| method | path | auth | purpose |
| --- | --- | --- | --- |
| GET | `/api/v1/template-skeletons` | contributor | list (catalog filters) |
| GET | `/api/v1/template-skeletons/by-key/:templateKey` | contributor | fetch by stable key |
| GET | `/api/v1/template-skeletons/:id` | contributor | fetch by internal id |
| POST | `/api/v1/template-skeletons` | platform admin | create |
| PATCH | `/api/v1/template-skeletons/:id` | platform admin | update metadata and/or content |
| DELETE | `/api/v1/template-skeletons/:id` | platform admin | soft-delete |

List filters (query string, validated by Zod in the service): `category`, `status`,
`pageType`, `tags`, `query`. Listing is hard-capped at 500 rows (pagination
deferred).

For gallery browse without layout/content payloads, use
[template catalog](./template-catalog.md) (`/api/v1/template-catalog`).

`bun run db:seed` inserts published Starter Template skeletons for local/UAT
catalog browse (Phase 2E — see [template-catalog.md §4](./template-catalog.md)).
Seed is insert-only by `templateKey` (existing rows are not updated).

`POST /api/v1/pages/from-template` resolves one published skeleton by id or key and
copies its validated layout into a new site-scoped draft page. The page stores
an independent JSON document plus display-only provenance columns
(`sourceTemplateId`, `sourceTemplateKey`, `sourceTemplateVersion`,
`instantiatedAt`). No skeleton row is updated. See
[template catalog §5](./template-catalog.md#5-page-instantiation-phase-2c-b) and
[§7](./template-catalog.md#7-template-provenance-phase-3).

Preview assets: see [template-skeleton-assets.md](./template-skeleton-assets.md).

---

## 3. Storage abstraction

Repositories implement `TemplateSkeletonStorage` and
`TemplateSkeletonAssetStorage` from `@ob-cms/template-registry`. Services inject
via `TEMPLATE_SKELETON_STORAGE` / `TEMPLATE_SKELETON_ASSET_STORAGE` tokens.

---

## 4. Out of scope (later phases)

- View Template navigation / catalog deep-link
- Template sync / update-from-template
- Binary asset upload (URLs/metadata references only in this phase)
