/**
 * HubSpot import shapes — mirror the API `modules/hubspot-import` DTOs/results.
 * Site-scoped via the X-Site-Id header (Axios mutator), so paths are relative.
 */

export interface HubspotPreviewItem {
  hsId: string;
  name: string;
  slug: string;
  updatedAt: string;
}

export interface HubspotPreview {
  pages: HubspotPreviewItem[];
  posts: HubspotPreviewItem[];
}

export interface ImportSummary {
  importedPages: number;
  importedPosts: number;
  skipped: { name: string; reason: string }[];
}

/** POST /hubspot-import/run body */
export interface RunImportPayload {
  token: string;
  pageIds: string[];
  postIds: string[];
}

/** One item of the offline export JSON array. */
export interface HubspotExportItem {
  name: string;
  slug?: string;
  html: string;
  metaDescription?: string;
  type?: "page" | "post";
}
