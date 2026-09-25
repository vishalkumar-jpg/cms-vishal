# Dynamic Collections (Custom Content Types)

A HubDB / WordPress-CPT equivalent for OB-CMS. A marketer defines a per-site
**collection** (e.g. Case Studies, Team, Products) with a field schema, manages
**items**, and renders them on pages via a dynamic **Collection List** block plus
dynamic **item detail** pages.

## 1. Data model (`0007_collections.sql`)

Two tenant-private tables in the `ob_cms` schema (siteId NOT NULL → all access
goes through the `ScopedRepository` hard predicate).

### `collections` (prefix `col`)
| column | type | notes |
| --- | --- | --- |
| baseColumns | — | KSUID id + created/updated/deleted + created/updated_by |
| `siteId` | varchar(50) | FK → sites, ON DELETE cascade |
| `name` | varchar(200) | unique per site (`col_site_name_uq`) |
| `slug` | varchar(200) | unique per site (`col_site_slug_uq`) |
| `fields` | jsonb | `CollectionFieldDef[]` = `{ key, label, type, required }` |
| `detailLayout` | jsonb | nullable shared `SerializedLayout` for `/c/...` (migration `0040`); null → generic field renderer |

`type` ∈ `text | richtext | number | boolean | image | date | reference`.

Items **do not** store a Craft layout. `detailLayout` is validated on write via
`deserializeLayout` (same contract as `pages.draftLayout`). Renderer/builder
wiring for custom detail layouts is a later phase.

### `collection_items` (prefix `cit`)
| column | type | notes |
| --- | --- | --- |
| baseColumns | — | as above |
| `siteId` | varchar(50) | FK → sites |
| `collectionId` | varchar(50) | FK → collections, cascade |
| `slug` | varchar(200) | unique per collection (`cit_collection_slug_uq`) |
| `data` | jsonb | values keyed by field key |
| `status` | varchar(20) | `draft | published` |
| `publishedAt` | timestamptz | set on publish |

Schema lives in `src/database/schema/collections.schema.ts` and is exported via
the schema barrel. The migration is registered in `migrations/meta/_journal.json`
(idx 7, tag `0007_collections`).

## 2. API endpoints — `src/modules/collections/`

Admin surface (`CollectionsController`, site-scoped via `X-Site-Id`,
`@Roles`, audited, DTO/zod-validated):

| method | path | role | purpose |
| --- | --- | --- | --- |
| GET | `/api/v1/collections` | contributor | list collections |
| POST | `/api/v1/collections` | editor | create (with field schema) |
| GET | `/api/v1/collections/:id` | contributor | one collection |
| PUT | `/api/v1/collections/:id` | editor | update name/slug/fields |
| DELETE | `/api/v1/collections/:id` | editor | soft-delete |
| GET | `/api/v1/collections/:id/items` | contributor | list items (page/pageSize/status/sort) |
| POST | `/api/v1/collections/:id/items` | contributor | create draft item |
| GET | `/api/v1/collections/:id/items/:itemId` | contributor | one item |
| PUT | `/api/v1/collections/:id/items/:itemId` | contributor | update item |
| POST | `.../items/:itemId/publish` | editor | publish |
| POST | `.../items/:itemId/unpublish` | editor | revert to draft |
| DELETE | `.../items/:itemId` | editor | soft-delete |

Item `data` is projected onto ONLY the collection's known field keys and coerced
per declared type (unknown keys are dropped). Every mutation is audited.

Public surface (`PublicCollectionsController`, `@Public`, host-resolved via the
`SiteResolver` — a client-supplied siteId is never trusted; only **published**
items are served, else 404):

| method | path | purpose |
| --- | --- | --- |
| GET | `/api/v1/public/collections/:slug/items?limit&sort` | published items of a collection |
| GET | `/api/v1/public/collections/:slug/items/:itemSlug` | one published item |

Public reads are Redis-cached under `render:<siteId>:collection:*`. Item
publish/unpublish/update/delete (and collection update/delete) enqueue a
`cache-purge` job with `entity: "collection"`; the worker's existing
`render:<siteId>:*` sweep invalidates them. The module is registered in
`app.module.ts` and imports `SeoModule` for the `SiteResolver`.

## 3. Collection List block — `packages/blocks` + `packages/block-schema`

- `collection-context.tsx` (`"use client"`): `CollectionRenderContext` with
  `getItems(collectionSlug, opts) => Promise<CollectionItem[]>`. Mirrors
  `FormRenderContext` / `ReusableBlockContext`. Kept in its own `"use client"`
  module so the renderer's RSC build never sees `createContext` at module load.
- `blocks/collection-list.tsx` (`"use client"`, `forwardRef`): props
  `{ collectionSlug?, limit?, columns?, sort?, cardFields?, linkPattern?, styles? }`.
  Resolves items via context after mount (`useMounted` → SSR-safe; static
  placeholder when unset / no context / loading). Renders a responsive grid of
  cards; `cardFields` = `[imageKey?, titleKey?, excerptKey?]`; `linkPattern`
  builds each href (`:slug` → item slug).
- Registered as `"Collection List"` in `registry.tsx` (`blockRegistry`) and
  `block-props.ts` (`collectionListSchema` in `blockPropSchemas`). Block tests
  assert it resolves (31 registered block types).

## 4. Renderer — proxy + live provider + item detail

- Proxy routes (forward the tenant Host to the host-resolved public API):
  - `app/api/collections/[slug]/items/route.ts` → `/api/v1/public/collections/:slug/items`
  - `app/api/collections/[slug]/items/[itemSlug]/route.ts` → single item.
- `components/collection-provider.tsx` — `LiveCollectionProvider` (`"use client"`)
  calls the same-origin proxy. Wired into `app/[[...slug]]/page.tsx` around
  `RenderLayout` (alongside the form/reusable providers), so Collection List
  blocks resolve on the public site.
- Item detail route: `app/c/[collection]/[item]/page.tsx` (Server Component).
  Resolves host → site, fetches one published item, renders a field-driven
  template (image/richtext/boolean/reference/text). `generateMetadata` for SEO
  (title/description/OG from the item's fields). 404 (`notFound`) when missing.
  **Custom detail layouts:** `collections.detail_layout` persists a shared
  `SerializedLayout` (admin create/update). Public **item** responses include
  `collection.detailLayout` (null when unset); **list** responses omit it to
  avoid large payloads. The `/c/...` route still uses the generic field renderer
  until a later renderer PR switches on that field.

## 5. Admin — collection builder, item manager, block config

- Sidebar **Collections** entry (Site group) → `/collections`.
  - `Collections.tsx`: list + create (name/auto-slug) collections.
  - `CollectionEditor.tsx` (`/collections/:id`): two tabs —
    - **Fields**: define the schema (add/remove/reorder; key/label/type/required).
    - **Items**: `components/ItemsManager.tsx` — table of items by their fields,
      create/edit via a form generated from the field schema
      (text/richtext/number/boolean/image-picker/date/reference),
      publish/unpublish/delete.
  - Hooks (`hooks/useCollections.ts`) + API (`api/collections.api.ts`) follow the
    wrapped-hook + `ADMIN_QUERY_KEYS` + admin-axios (`X-Site-Id`) patterns.
- Builder: when a Collection List block is selected, the property panel offers a
  **collection picker** (`property/CollectionPickerField.tsx`, dispatched via the
  new `"collection"` control kind for the `collectionSlug` prop) plus
  limit/columns/sort/cardFields controls (auto-generated from the zod schema).
  The block is draggable from the palette's **Dynamic** category.
  `components/PreviewCollectionProvider.tsx` (admin axios) wraps the canvas so the
  block previews real items (draft + published) on the canvas.
