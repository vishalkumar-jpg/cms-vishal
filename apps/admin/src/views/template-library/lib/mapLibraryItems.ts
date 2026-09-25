import {
  canUseTemplate,
  previewCoverUrl,
  previewDescription,
  previewThumbnailUrl,
} from "@/views/template-catalog/lib/templatePreview";
import type { TemplateCatalogEntry } from "@/views/template-catalog/types";
import { resolveTemplateKind, type Template } from "@/views/templates/types";
import { isSiteOwnedTemplate } from "./mineTemplateActions";
import { MINE_TEMPLATE_DESCRIPTION } from "../constants";
import type {
  TemplateLibraryMineItem,
  TemplateLibraryStarterItem,
} from "../types";

/** Map a platform catalog entry to the shared library item shape. */
export const mapStarterToLibraryItem = (
  entry: TemplateCatalogEntry,
): TemplateLibraryStarterItem => ({
  id: entry.id,
  source: "starter",
  title: entry.displayName,
  description: previewDescription(entry.description),
  preview: {
    thumbnailUrl: previewThumbnailUrl(entry),
    coverUrl: previewCoverUrl(entry.templateKey),
  },
  metadata: {
    category: entry.category,
    tags: entry.tags,
    featured: entry.featured,
    status: entry.status,
    templateKey: entry.templateKey,
    version: entry.version,
    supportedPageTypes: entry.supportedPageTypes,
    canUse: canUseTemplate(entry.status),
  },
  sourceData: entry,
});

/** Map a site-scoped saved template to the shared library item shape. */
export const mapMineToLibraryItem = (
  template: Template,
  activeSiteId: string | null,
): TemplateLibraryMineItem => ({
  id: template.id,
  source: "mine",
  title: template.name,
  description: MINE_TEMPLATE_DESCRIPTION,
  preview: {},
  metadata: {
    siteId: template.siteId,
    kind: resolveTemplateKind(template.kind),
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    canManage: isSiteOwnedTemplate(template.siteId, activeSiteId),
  },
  sourceData: template,
});

export const mapStartersToLibraryItems = (
  entries: TemplateCatalogEntry[],
): TemplateLibraryStarterItem[] => entries.map(mapStarterToLibraryItem);

export const mapMineToLibraryItems = (
  templates: Template[],
  activeSiteId: string | null,
): TemplateLibraryMineItem[] =>
  templates
    .map((template) => mapMineToLibraryItem(template, activeSiteId))
    .filter((item) => item.metadata.canManage);
