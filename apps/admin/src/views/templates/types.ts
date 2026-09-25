import type { SerializedLayout } from "@ob-cms/block-schema";

export type TemplateKind = "page" | "section";

/** Legacy API rows and older saves may omit kind; treat as page. */
export const DEFAULT_TEMPLATE_KIND: TemplateKind = "page";

export const resolveTemplateKind = (kind: TemplateKind | undefined): TemplateKind =>
  kind ?? DEFAULT_TEMPLATE_KIND;

/**
 * A reusable template = a serialized layout fragment (its own ROOT) that can be
 * inserted into a page. Mirrors an assumed `templates` table (Wave 2b).
 */
export interface Template {
  id: string;
  /** NULL for global presets returned alongside site-owned templates. */
  siteId: string | null;
  name: string;
  kind: TemplateKind;
  /** A self-contained SerializedLayout (own root) for the saved fragment. */
  layout: SerializedLayout;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplatePayload {
  name: string;
  layout: SerializedLayout;
  kind?: TemplateKind;
}

export interface ListTemplatesQuery {
  kind?: TemplateKind;
}

export interface UpdateTemplatePayload {
  name: string;
}
