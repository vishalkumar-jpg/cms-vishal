export * from "./types";
export * from "./extract";
export * from "./legacy-html";
export * from "./canonicalize";
export {
  extractHubspotHubfsStoragePath,
  hubspotAssetIdentityKey,
  isLikelyHubspotMediaUrl,
  normalizeHubspotAssetUrl,
} from "./asset-identity";
export { buildHubspotAssetMigrationUrlMap } from "./asset-migration-url-map";
export { discoverHubspotMediaAssets, discoverHubspotMediaAssetsFromPage } from "./asset-discovery";
export { discoverResponsiveAssetDiagnostics } from "./asset-responsive-diagnostics";
export { extractHttpUrlsFromSrcset } from "./json-utils";
export {
  rewriteAssetUrlsInHtml,
  rewriteAssetUrlsInJson,
  rewriteAssetUrlsInSerializedLayout,
  rewriteSrcsetAttributeValue,
} from "./rewrite-asset-references";
export {
  hubspotImportNormalizedFromSource,
  hubspotScopedImportFromSource,
  hubspotScopedImportFromUpm,
} from "./import-normalized";
export type { HubspotScopedImportBundle, HubspotScopedImportOptions } from "./import-normalized";
export {
  HUBSPOT_ASSET_MIGRATION_DIAGNOSTIC_CODES,
  type HubspotAssetMigrationDiagnosticCode,
} from "./asset-migration-diagnostics";
export { isHubspotModuleLike, extractHtmlFragmentsFromObject, collectHttpUrlsFromJson } from "./extract-layout";
export {
  MODULE_CONVERTED_NATIVE,
  NATIVE_COUNTER_SECTION,
  NATIVE_FEATURE_LIST,
  NATIVE_HEADING,
  NATIVE_RICH_TEXT,
  NATIVE_STEP_CARDS,
  NATIVE_TABS,
  NATIVE_IMAGE,
  NATIVE_GALLERY,
  NATIVE_LOGO_CAROUSEL,
  moduleParamsBlockNativeConversion,
  tryConvertHubspotModuleNode,
} from "./convert-modules";
export type {
  HubspotModuleConversionBlock,
  HubspotModuleConversionResult,
} from "./convert-modules";
export {
  convertHubspotUpmToLayout,
  hubspotLegacyHtmlEmbedLayout,
  HUBSPOT_LAYOUT_GRID_COLUMNS,
} from "./convert-layout";
export type {
  ConvertHubspotUpmToLayoutOptions,
  HubspotDeferredModuleRef,
  HubspotLayoutConversionResult,
} from "./convert-layout";
export {
  extractHubspotDesignFromSourceNode,
  hubspotDesignEntryKey,
} from "./hubspot-design-extract";
export type {
  HubspotDesignEntry,
  HubspotDesignLosslessSlice,
  HubspotNodeDesignExtraction,
} from "./hubspot-design-extract";
export { buildHubspotPageDesignContract } from "./hubspot-design-contract";
export type { HubspotNodeDesignBundle, HubspotPageDesignContract } from "./hubspot-design-contract";
export {
  applyHubspotDesignToBlock,
  designContractDiagnosticsToLayout,
  indexHubspotDesignBundlesBySourcePath,
  DESIGN_APPLY_ROLE_UNMAPPED,
} from "./apply-hubspot-design";
export type { HubspotDesignApplyResult } from "./apply-hubspot-design";
export { HUBSPOT_DESIGN_ROLE_MAP_BY_BLOCK, hubspotDesignRoleMapForBlock } from "./hubspot-design-part-map";
