/**
 * Media library shapes — mirror the API `media` table (MediaRow) and the
 * media DTOs (presign/confirm/update). Site-scoped via X-Site-Id.
 */
export interface MediaVariant {
  width: number;
  format: string;
  url: string;
  bytes: number;
  height?: number;
}

export interface FocalPoint {
  x: number;
  y: number;
}

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MediaItem {
  id: string;
  siteId: string;
  storageKey: string;
  url: string | null;
  type: string;
  size: number | null;
  width: number | null;
  height: number | null;
  alt: string | null;
  tags: string[] | null;
  variants: MediaVariant[];
  focalPoint: FocalPoint | null;
  cropRect: CropRect | null;
  folderId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface MediaFolder {
  id: string;
  siteId: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MediaUsageRef {
  entityType: "page" | "post" | "collection-item" | "site-chrome";
  entityId: string;
  title: string;
  slug?: string;
}

export interface CreateFolderPayload {
  name: string;
  parentId?: string | null;
}

export interface UpdateFolderPayload {
  name?: string;
  parentId?: string | null;
}

export interface MoveMediaPayload {
  mediaIds: string[];
  folderId?: string | null;
}

/** POST /media/presign */
export interface PresignPayload {
  filename: string;
  contentType: string;
  size?: number;
}

export interface PresignResult {
  media: MediaItem;
  uploadUrl: string;
  storageKey: string;
}

/** POST /media/confirm */
export interface ConfirmPayload {
  mediaId: string;
  size?: number;
  width?: number;
  height?: number;
}

/** PATCH /media/:id */
export interface UpdateMediaPayload {
  alt?: string;
  tags?: string[];
  focalPoint?: FocalPoint;
  folderId?: string | null;
}

/** GET /media query params */
export interface ListMediaQuery {
  type?: string;
  q?: string;
  tag?: string;
  /** Omit = all; "root" = unfiled; otherwise a folder id. */
  folderId?: string;
}
