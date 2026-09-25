/**
 * Collections manager types. Mirror the apps/api collections module DTOs exactly
 * so the admin client and server stay in lockstep.
 */

import type { SerializedLayout } from "@ob-cms/block-schema";

export const COLLECTION_FIELD_TYPES = [
  "text",
  "richtext",
  "number",
  "boolean",
  "image",
  "date",
  "reference",
] as const;

export type CollectionFieldType = (typeof COLLECTION_FIELD_TYPES)[number];

export interface CollectionField {
  key: string;
  label: string;
  type: CollectionFieldType;
  required?: boolean;
}

export interface Collection {
  id: string;
  siteId: string;
  name: string;
  slug: string;
  fields: CollectionField[];
  /** Shared detail layout; null/undefined → generic /c renderer fallback. */
  detailLayout?: SerializedLayout | null;
  createdAt: string;
  updatedAt: string;
}

export type CollectionItemStatus = "draft" | "published";

export interface CollectionItem {
  id: string;
  siteId: string;
  collectionId: string;
  slug: string;
  data: Record<string, unknown>;
  status: CollectionItemStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ItemsPage {
  items: CollectionItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateCollectionPayload {
  name: string;
  slug: string;
  fields?: CollectionField[];
  detailLayout?: SerializedLayout | null;
}

export interface UpdateCollectionPayload {
  name?: string;
  slug?: string;
  fields?: CollectionField[];
  detailLayout?: SerializedLayout | null;
}

export interface CreateItemPayload {
  slug: string;
  data?: Record<string, unknown>;
}

export interface UpdateItemPayload {
  slug?: string;
  data?: Record<string, unknown>;
}

export interface ListItemsParams {
  page?: number;
  pageSize?: number;
  status?: CollectionItemStatus;
  sort?: string;
}
