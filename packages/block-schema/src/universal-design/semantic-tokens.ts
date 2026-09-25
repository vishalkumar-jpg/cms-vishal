/** Semantic roles for design entries — source-agnostic part identifiers for H2 mapping. */
export const DESIGN_ROLE_MODULE_ROOT = "surface.module";
export const DESIGN_ROLE_STRUCTURAL = "surface.structural";

export const DESIGN_PART_ROLE_PREFIX = "part:" as const;
export const DESIGN_SETTINGS_ROLE_PREFIX = "settings:" as const;

export const designPartRole = (partKey: string): string => `${DESIGN_PART_ROLE_PREFIX}${partKey}`;

export const designSettingsRole = (group: string, field?: string): string =>
  field
    ? `${DESIGN_SETTINGS_ROLE_PREFIX}${group}.${field}`
    : `${DESIGN_SETTINGS_ROLE_PREFIX}${group}`;

/** Map semantic role hints to StyleModel section priorities (deterministic). */
export const rolePrefersTypographyLayer = (role: string): boolean =>
  role.startsWith(DESIGN_PART_ROLE_PREFIX) &&
  /number|title|prefix|suffix|label|heading|body|description|tab|panel|badge|button|author|post_meta|tags|featured_image/i.test(
    role,
  );

export const rolePrefersLayoutLayer = (role: string): boolean =>
  role.includes("grid") || role.includes("layout") || role.includes("alignment");
