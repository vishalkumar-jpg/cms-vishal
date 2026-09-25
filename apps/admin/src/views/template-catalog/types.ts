/**
 * Admin-facing types for the read-only platform template catalog.
 * Mirrors `@ob-cms/template-registry` catalog entry shapes without adding a
 * package dependency (thin API client pattern used by other admin views).
 */

export const TEMPLATE_CATALOG_CATEGORIES = [
  "marketing",
  "content",
  "legal",
  "utility",
  "campaign",
] as const;

export type TemplateCatalogCategory = (typeof TEMPLATE_CATALOG_CATEGORIES)[number];

export type TemplateCatalogStatus = "draft" | "published" | "archived";

export type TemplateCatalogEntry = {
  id: string;
  templateKey: string;
  displayName: string;
  description: string;
  category: TemplateCatalogCategory;
  supportedPageTypes: string[];
  tags: string[];
  version: string;
  status: TemplateCatalogStatus;
  featured?: boolean;
  thumbnail?: string;
  owner?: string;
  createdAt: string;
  updatedAt: string;
};

/** Query params accepted by GET /api/template-catalog. */
export type TemplateCatalogQuery = {
  category?: TemplateCatalogCategory;
  status?: TemplateCatalogStatus;
  query?: string;
  featured?: boolean;
  includeAssets?: boolean;
  sort?: "displayName" | "updatedAt" | "featured";
};
