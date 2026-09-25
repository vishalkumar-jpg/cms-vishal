/** Corpus-proven Pike / HubSpot module metadata keys that may remain unmapped on native blocks. */
export const HUBSPOT_PIKE_MODULE_STYLE_METADATA_KEYS = ["animation", "styles"] as const;

export const HUBSPOT_PIKE_MODULE_METADATA_TOP_LEVEL_KEYS = [
  "child_css",
  "css",
  "css_class",
  "definition_id",
  "field_types",
  "module_id",
  "overrideable",
  "parent_widget_container",
  "path",
  "schema_version",
  "settings",
  "smart_objects",
  "smart_type",
  "tag",
  "type",
  "wrap_field_tag",
] as const;

/** Metadata allowlist for converters that cannot preserve animation/styles on native blocks. */
export const HUBSPOT_PIKE_MODULE_METADATA_WITHOUT_STYLE_KEYS = [
  ...HUBSPOT_PIKE_MODULE_METADATA_TOP_LEVEL_KEYS,
] as const;

/** Full Pike metadata including style groups (gallery, logos). */
export const HUBSPOT_PIKE_MODULE_METADATA_WITH_STYLE_KEYS = [
  ...HUBSPOT_PIKE_MODULE_STYLE_METADATA_KEYS,
  ...HUBSPOT_PIKE_MODULE_METADATA_TOP_LEVEL_KEYS,
] as const;

export const hubspotModulePathEndsWith = (path: unknown, suffix: string): boolean => {
  if (typeof path !== "string") return false;
  const normalizedPath = path.replace(/^\//, "");
  const normalizedSuffix = suffix.replace(/^\//, "");
  return (
    normalizedPath === normalizedSuffix || normalizedPath.endsWith(`/${normalizedSuffix}`)
  );
};
