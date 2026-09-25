import type { SerializedLayout } from "@ob-cms/block-schema";
import type {
  TemplateCatalogCategory,
  TemplateCatalogStatus,
} from "./types";

/** Admin-facing skeleton record from GET /template-skeletons/:id or by-key. */
export type TemplateSkeletonRecord = {
  metadata: {
    id: string;
    templateKey: string;
    displayName: string;
    description: string;
    category: TemplateCatalogCategory;
    supportedPageTypes: string[];
    tags: string[];
    version: string;
    status: TemplateCatalogStatus;
    schemaVersion: string;
    createdAt: string;
    updatedAt: string;
    previewMetadata?: {
      featured?: boolean;
      thumbnail?: string;
    };
  };
  content: {
    contentSchemaVersion: string;
    layout: SerializedLayout;
  };
};
