import type {
  TemplateCatalogCategory,
  TemplateCatalogEntry,
  TemplateCatalogStatus,
} from "@/views/template-catalog/types";
import type { Template, TemplateKind } from "@/views/templates/types";

export type TemplateLibrarySource = "starter" | "mine";

export type TemplateLibraryPreview = {
  thumbnailUrl?: string;
  coverUrl?: string;
};

/** Fields shared by starter and mine items for future library cards/filters. */
export type TemplateLibraryItemBase = {
  id: string;
  source: TemplateLibrarySource;
  title: string;
  description: string;
  preview: TemplateLibraryPreview;
};

/** Starter-only metadata — kept separate from the shared card surface. */
export type TemplateLibraryStarterMetadata = {
  category: TemplateCatalogCategory;
  tags: string[];
  featured?: boolean;
  status: TemplateCatalogStatus;
  templateKey: string;
  version: string;
  supportedPageTypes: string[];
  canUse: boolean;
};

/** Mine-only metadata — kept separate from the shared card surface. */
export type TemplateLibraryMineMetadata = {
  siteId: string | null;
  kind: TemplateKind;
  createdAt: string;
  updatedAt: string;
  /** False for global presets mixed into list responses. */
  canManage: boolean;
};

export type TemplateLibraryStarterItem = TemplateLibraryItemBase & {
  source: "starter";
  metadata: TemplateLibraryStarterMetadata;
  sourceData: TemplateCatalogEntry;
};

export type TemplateLibraryMineItem = TemplateLibraryItemBase & {
  source: "mine";
  metadata: TemplateLibraryMineMetadata;
  sourceData: Template;
};

export type TemplateLibraryItem = TemplateLibraryStarterItem | TemplateLibraryMineItem;
