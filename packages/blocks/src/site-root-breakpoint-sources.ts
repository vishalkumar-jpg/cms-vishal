/**
 * Server-safe breakpoint-source constants for `OBSiteRoot`.
 *
 * Kept out of `site-root.tsx` ("use client") so Server Components such as
 * `PublishedPageFrame` can pass `breakpointSource={OBSiteRootBreakpointSources.container}`
 * across the RSC boundary without the value becoming undefined.
 */
export const OBSiteRootBreakpointSources = {
  container: "container",
} as const;

export type OBSiteRootBreakpointSource =
  (typeof OBSiteRootBreakpointSources)[keyof typeof OBSiteRootBreakpointSources];
