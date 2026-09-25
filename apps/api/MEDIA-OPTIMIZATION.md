# Media optimization, image editing & organization (gap D23)

Extends the existing media library (S3/MinIO presign → confirm → catalog row)
with responsive/next-gen variants, focal-point + crop editing, folders, and
where-used tracking. Touches `apps/api/src/modules/media/**`,
`apps/worker/src/**`, the media schema, and `apps/admin/src/views/media/**`.

## sharp requirement (IMPORTANT)

`sharp` was **NOT** a dependency of this monorepo. It ships a native binary
that cannot be compiled in the build sandbox, so the image pipeline is wired but
its native deps are loaded via **guarded dynamic imports** in the worker
(`apps/worker/src/processors/image-process.processor.ts`):

- `sharp` — actual resize/crop/format work.
- `@aws-sdk/client-s3` — reading the source + uploading derivatives (the worker
  has no AWS SDK of its own).

When either is absent the processor **degrades gracefully**: it logs a warning,
marks the media row `ready`, and leaves `variants` empty — nothing crashes, and
every non-image-processing feature (folders, usage, focal-point storage, crop
params) works fully. To enable real variant/crop generation at runtime:

```
cd apps/worker && bun add sharp @aws-sdk/client-s3
```

The worker reads the same S3/MinIO env the API uses (`S3_ENDPOINT`, `S3_BUCKET`,
`S3_PUBLIC_URL`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`).

## 1. Responsive variants + next-gen formats

On upload-confirm (`MediaService.confirm`) the API enqueues a `media-process`
job (this enqueue path already existed). The new worker processor
`processImage`:

1. loads the `media` row (Postgres is the source of truth; only ids/keys travel
   through Redis),
2. reads the source from S3, reads intrinsic `width`/`height`,
3. for each target width (`320 / 640 / 1024 / 1920`, skipping widths larger than
   the source) emits a next-gen `webp` derivative, uploads it to
   `sites/<id>/variants/<file>-<w>.webp`,
4. writes `width`, `height`, and a `variants` jsonb array back to the row,
   `status = ready`.

### `variants` data shape (for `srcset`)

```jsonc
// media.variants : MediaVariant[]
[
  { "width": 320,  "format": "webp", "url": "…/variants/hero-320.webp",  "bytes": 12048 },
  { "width": 640,  "format": "webp", "url": "…/variants/hero-640.webp",  "bytes": 28110 },
  { "width": 1024, "format": "webp", "url": "…/variants/hero-1024.webp", "bytes": 61233 }
]
```

The media API row exposes `variants` + intrinsic `width`/`height`, so the Image
block / renderer (a different lane) can build:
`srcset="…-320.webp 320w, …-640.webp 640w, …"`. We only expose the data here.

## 2. Crop / focal point

- `media.focalPoint : {x,y}` (0–1, default `{0.5,0.5}`) — set via
  `PATCH /api/media/:id` (`{ focalPoint }`). Used for smart cropping by consumers.
- `POST /api/media/:id/crop` `{x,y,w,h}` (pixels relative to the intrinsic
  image) — stores `cropRect` on the row immediately (responsive UI), sets
  `status = processing`, and enqueues a `media-process` **crop** job. The worker
  extracts the rect then re-derives variants from the cropped image.
- Admin: the media detail dialog "Edit image" tab — click to drop the focal dot
  (saved immediately), drag to draw a crop box, "Apply crop".

## 3. Folders / organization

- `media_folders` table (`mdf` prefix): `siteId`, `name`, `parentId` (self-FK,
  NULL = root). `media.folderId` references it (NULL = unfiled/root).
- API (all tenant-scoped via `ScopedRepository`):
  - `GET /api/media/folders` — list (tree built client-side)
  - `POST /api/media/folders` `{name, parentId?}`
  - `PATCH /api/media/folders/:id` `{name?, parentId?}` (rename / re-parent)
  - `DELETE /api/media/folders/:id` — soft-delete; children re-parent to this
    folder's parent, assets move to root (nothing orphaned)
  - `POST /api/media/move` `{mediaIds[], folderId?}` — bulk move
  - `GET /api/media?folderId=<id|root>` — filter the grid (`root` = unfiled)
- Admin: a folder tree sidebar in the Media view with create/rename/delete and
  drag-a-tile-onto-a-folder to move.

## 4. Where-used / usage tracking

`GET /api/media/:id/usage` → `MediaUsageRef[]`. A read-only scan that matches the
media **id** and its public **URL** inside the serialized jsonb of:

- `pages` (`draftLayout`, `publishedLayout`, `seo`),
- `posts` (`layout`, `seo`, plus `coverMediaId = :id`),
- `collection_items` (`data`),
- `reusable_blocks` (`layout`) — a hit means it's used everywhere the block is placed,
- `site_settings` chrome (`headerLayout`, `footerLayout`) + branding image URLs.

Implemented as an OR-group of `column::text ILIKE '%needle%'` (parenthesized,
then ANDed into the tenant predicate). Cheap, index-free, and correct for
"is this asset used anywhere". Admin: a "Used in" tab in the detail dialog.

## Schema / migration

Migration `0011_media_optimization.sql` (additive + idempotent): creates
`media_folders`, adds `media.focal_point` / `media.crop_rect` / `media.folder_id`
(+ `med_folder_idx`), and switches the existing `media.variants` default from
`{}` to `[]`. The `variants` / `width` / `height` columns already existed.
