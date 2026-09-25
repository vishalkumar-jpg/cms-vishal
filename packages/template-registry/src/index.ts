export {
  TEMPLATE_CATEGORIES,
  TEMPLATE_STATUSES,
  templateCategorySchema,
  templateStatusSchema,
  templateMetadataSchema,
  templateRegistrationInputSchema,
  templateUpdateInputSchema,
  templateQuerySchema,
  type TemplateCategory,
  type TemplateStatus,
  type TemplateMetadata,
  type TemplateRegistrationInput,
  type TemplateUpdateInput,
  type TemplateQuery,
} from "./schema";

export {
  TemplateRegistry,
  TemplateRegistryError,
  createTemplateRegistry,
} from "./registry";

export {
  BUILTIN_TEMPLATE_SEEDS,
  BUILTIN_TEMPLATE_IDS,
  createBuiltinTemplateRegistry,
} from "./catalog";

export {
  TEMPLATE_CATALOG_SORT_VALUES,
  TemplateCatalogValidationError,
  parseTemplateCatalogAssetSummary,
  parseTemplateCatalogEntry,
  parseTemplateCatalogQuery,
  templateCatalogAssetSummarySchema,
  templateCatalogEntrySchema,
  templateCatalogQuerySchema,
  templateCatalogSortSchema,
  type TemplateCatalogAssetSummary,
  type TemplateCatalogEntry,
  type TemplateCatalogQuery,
  type TemplateCatalogSort,
} from "./catalog-schema";

export {
  SKELETON_CONTENT_SCHEMA_VERSION,
  parseCreateTemplateSkeletonInput,
  parseUpdateTemplateSkeletonInput,
  parseTemplateSkeletonListQuery,
  TemplateSkeletonValidationError,
  type CreateTemplateSkeletonInput,
  type TemplateSkeletonContent,
  type TemplateSkeletonListQuery,
  type TemplateSkeletonRecord,
  type UpdateTemplateSkeletonInput,
} from "./skeleton-schema";

export {
  assertMimeMatchesAssetType,
  isSingletonAssetType,
  parseCreateTemplateSkeletonAssetInput,
  parseUpdateTemplateSkeletonAssetInput,
  TemplateSkeletonAssetValidationError,
  type CreateTemplateSkeletonAssetInput,
  type TemplateSkeletonAssetRecord,
  type UpdateTemplateSkeletonAssetInput,
} from "./asset-schema";

export {
  TEMPLATE_SKELETON_STORAGE,
  TEMPLATE_SKELETON_ASSET_STORAGE,
  TEMPLATE_CATALOG_STORAGE,
  TemplateSkeletonStorageError,
  TemplateSkeletonAssetStorageError,
  TemplateCatalogStorageError,
  type TemplateSkeletonStorage,
  type TemplateSkeletonAssetStorage,
  type TemplateCatalogStorage,
} from "./storage";
