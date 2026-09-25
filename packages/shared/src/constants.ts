/**
 * Frontend query-key registry pattern.
 *
 * CONVENTION (from _CONVENTIONS.md): never use string literals for TanStack
 * Query keys in views — reference this enum so renames are one edit and typos
 * are caught at compile time. Wrapped SDK hooks under `views/<feature>/hooks/`
 * pass these as their query key.
 *
 * TODO(W2): extend as feature SDKs land (PAGES, MEDIA, FORMS, ...).
 */
export enum QUERY_KEYS {
  AUTH_ME = "auth.me",
  TENANTS = "tenants",
  SITES = "sites",
  SITE_MEMBERS = "site-members",
  CUSTOM_ROLES = "custom-roles",
  PERMISSION_CATALOG = "permission-catalog",
}

/** Tenant resolution header used by the renderer + admin context. */
export const SITE_ID_HEADER = "x-site-id";

/** Current API version segment. Bump when introducing /api/v2. */
export const API_VERSION = "v1";

/** NestJS `setGlobalPrefix` value (no leading slash). */
export const API_GLOBAL_PREFIX = `api/${API_VERSION}`;

/** Global NestJS prefix — all controllers mount under `/api/v1`. */
export const API_PREFIX = `/${API_GLOBAL_PREFIX}`;

/** Public (host-resolved) API segment under the versioned prefix. */
export const PUBLIC_API_PATH = "public";

/** Full URI prefix for public API routes, e.g. `/api/v1/public/site`. */
export const PUBLIC_API_PREFIX = `${API_PREFIX}/${PUBLIC_API_PATH}`;

/** @deprecated Use PUBLIC_API_PREFIX */
export const PUBLIC_API_V1_PREFIX = PUBLIC_API_PREFIX;
