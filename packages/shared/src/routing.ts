/**
 * Reserved ROOT path segments on published sites.
 *
 * The renderer (apps/renderer) carves these namespaces out as FILE routes in
 * front of the `[[...slug]]` catch-all (blog/, c/, api/, __preview/, feeds,
 * sitemap/robots, analytics collectors, Next internals). A ROOT-LEVEL page
 * whose slug matches one of these would be silently shadowed by the file
 * route — the author's page becomes unreachable with no error — so the API
 * rejects such slugs at write time (see PagesService.assertRootSlugAllowed).
 *
 * Nested pages are unaffected: `/services/blog` is fine because its first
 * public path segment is `services`.
 *
 * NOTE: several entries (`_next`, `__preview`, `*.xml`, `robots.txt`,
 * `favicon.ico`) are already unrepresentable under the page-slug regex
 * (lowercase alnum + hyphen only). They are listed anyway so this constant is
 * the complete, self-contained map of the renderer's reserved namespaces and
 * stays correct if the slug rules ever loosen.
 *
 * When adding a new top-level route to apps/renderer/src/app, ADD IT HERE —
 * every entry shrinks the authorable slug space, so prefer nesting new system
 * routes under an existing reserved prefix (e.g. `api/...`).
 */
export const RESERVED_ROOT_SLUGS = [
  // Renderer file routes / route handlers.
  "api",
  "blog",
  "c",
  "collect",
  "identify",
  "feed.xml",
  "feed.atom",
  "sitemap.xml",
  "robots.txt",
  "__preview",
  // Next.js internals / well-known static files.
  "_next",
  "favicon.ico",
] as const;

export type ReservedRootSlug = (typeof RESERVED_ROOT_SLUGS)[number];

/** Whether `slug` would collide with a reserved root namespace (case-insensitive). */
export function isReservedRootSlug(slug: string): boolean {
  return (RESERVED_ROOT_SLUGS as readonly string[]).includes(slug.toLowerCase());
}
