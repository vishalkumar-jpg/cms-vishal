import { bigint, index, integer, jsonb, text, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "@database/base-columns";
import { obCmsSchema } from "./_schema";
import { sites } from "./sites.schema";
import { systemUsers } from "./system-users.schema";

/**
 * `media_folders` (prefix `mdf`) — a per-site folder for organizing the media
 * library into a tree. `parentId` self-FK builds the hierarchy (NULL = root).
 * Tenant-private (siteId NOT NULL) so all reads/writes go through the
 * ScopedRepository hard predicate.
 */
export const mediaFolders = obCmsSchema.table(
  "media_folders",
  {
    ...baseColumns("mdf"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    name: varchar({ length: 200 }).notNull(),
    /** Self-FK to the parent folder; NULL = a top-level (root) folder. */
    parentId: varchar({ length: 50 }),
  },
  (t) => [
    index("mdf_site_idx").on(t.siteId),
    index("mdf_parent_idx").on(t.parentId),
  ],
);

export type MediaFolderRow = typeof mediaFolders.$inferSelect;
export type NewMediaFolderRow = typeof mediaFolders.$inferInsert;

/**
 * One generated responsive/next-gen image variant (stored in `media.variants`).
 * The renderer/Image block use these to build a `srcset`.
 */
export interface MediaVariant {
  width: number;
  format: string; // "webp" | "avif" | "jpeg" | ...
  url: string;
  bytes: number;
  height?: number;
}

/** Normalized focal point (0–1 in both axes), the visual "center" for cropping. */
export interface FocalPoint {
  x: number;
  y: number;
}

/** A server-side crop request/result (pixels relative to the intrinsic image). */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * `media` (prefix `med`) — an asset in the per-site media library. The binary
 * lives in object storage (S3/MinIO) under `storageKey`; the row is the catalog
 * entry. `status` tracks the presign → confirm → processed lifecycle:
 *   pending (presigned, not yet uploaded) → ready (confirmed) — a worker job
 *   fills width/height/variants asynchronously.
 */
export const media = obCmsSchema.table(
  "media",
  {
    ...baseColumns("med"),
    siteId: varchar({ length: 50 })
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    storageKey: varchar({ length: 500 }).notNull(),
    url: varchar({ length: 1000 }),
    type: varchar({ length: 100 }).notNull(), // MIME type
    alt: varchar({ length: 500 }),
    tags: text().array().notNull().default([]),
    size: bigint({ mode: "number" }),
    width: integer(),
    height: integer(),
    /**
     * Responsive/next-gen derivatives produced by the worker image pipeline.
     * Array of MediaVariant ({ width, format, url, bytes }) the renderer uses to
     * build a `srcset`. Defaults to `[]` (no variants yet / non-image asset).
     */
    variants: jsonb().$type<MediaVariant[]>().notNull().default([]),
    /** Normalized focal point {x,y} in 0–1; default center. Drives smart crops. */
    focalPoint: jsonb().$type<FocalPoint>().notNull().default({ x: 0.5, y: 0.5 }),
    /** Last server-side crop request (pixels), echoed back for the editor. */
    cropRect: jsonb().$type<CropRect>(),
    /** Optional folder this asset lives in (NULL = library root). */
    folderId: varchar({ length: 50 }),
    status: varchar({ length: 20 }).notNull().default("pending"), // pending|ready|processing|failed
    uploadedBy: varchar({ length: 50 }).references(() => systemUsers.id, { onDelete: "set null" }),
  },
  (t) => [
    index("med_site_idx").on(t.siteId),
    index("med_site_type_idx").on(t.siteId, t.type),
    index("med_folder_idx").on(t.folderId),
  ],
);

export type MediaRow = typeof media.$inferSelect;
export type NewMediaRow = typeof media.$inferInsert;
