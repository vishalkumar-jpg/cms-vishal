# Template Skeleton Preview Assets

Metadata references for catalog preview imagery attached to a template skeleton.
**No binary upload** in this phase — rows store http(s) URLs or site-relative
paths only.

**Related:** [Template skeleton storage](./template-skeleton-storage.md) ·
[Template catalog](./template-catalog.md)

---

## 1. Data model (`0038_template_skeleton_assets.sql`)

Table: `template_skeleton_assets` (prefix `tsa`) in the `ob_cms` schema.

| column | type | notes |
| --- | --- | --- |
| baseColumns | — | KSUID id + timestamps + soft delete + actor ids |
| `skeletonId` | varchar(50) | FK → `template_skeletons`, cascade delete |
| `assetType` | varchar(30) | See asset types below |
| `storageKey` | varchar(500) | Optional future object-storage key |
| `url` | varchar(2000) | http(s) URL or path starting with `/` |
| `mimeType` | varchar(100) | Optional; validated against `assetType` when present |
| `width` / `height` / `size` | integer | Optional dimensions / byte size |
| `altText` | varchar(500) | Accessibility label |
| `sortOrder` | integer | Display ordering (default 0) |

### Asset types

| `assetType` | Singleton? | MIME expectation |
| --- | --- | --- |
| `thumbnail` | yes | `image/*` |
| `cover_image` | yes | `image/*` |
| `icon` | yes | `image/*` |
| `video_preview` | yes | `video/*` or `application/x-mpegURL` |
| `gallery_image` | no (multiple allowed) | `image/*` |

Singleton types are enforced by partial unique index
`tsa_skeleton_singleton_uidx` on active `(skeleton_id, asset_type)`.

Validation: `@ob-cms/template-registry` (`asset-schema.ts`) — URL rules reject
embedded control characters; MIME compatibility checked on create and when
`mimeType` changes on update.

---

## 2. API (nested under skeleton)

Base path: `/api/v1/template-skeletons/:id/assets`

| method | path | auth | purpose |
| --- | --- | --- | --- |
| GET | `/api/v1/template-skeletons/:id/assets` | contributor | list assets for a skeleton |
| POST | `/api/v1/template-skeletons/:id/assets` | platform admin | attach a preview reference |
| PATCH | `/api/v1/template-skeletons/:id/assets/:assetId` | platform admin | update metadata |
| DELETE | `/api/v1/template-skeletons/:id/assets/:assetId` | platform admin | soft-delete |

Creating or updating with a duplicate singleton `assetType` returns **409 Conflict**.

---

## 3. Out of scope

- S3/MinIO upload pipeline (use pre-hosted URLs for now)
- Image processing / CDN invalidation

Catalog gallery UI (browse + preview metadata) ships as admin **Starter
Templates** — see [template-catalog.md](./template-catalog.md).
