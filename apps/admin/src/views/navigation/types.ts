/**
 * Navigation shapes. Mirror the apps/api navigation module. A navigation row is
 * a site-scoped menu keyed by `location` ("header" | "footer" | ...), holding a
 * recursive `tree` of links. Defined locally until the Orval SDK is regenerated.
 */

/** Recursive navigation item. The server sanitizes to exactly these fields. */
export interface NavItem {
  label: string;
  /** Custom URL. Mutually exclusive with `pageId`. */
  href?: string;
  /** Reference to a site page. Mutually exclusive with `href`. */
  pageId?: string;
  /** Only `_blank` is supported (open in new tab). */
  target?: "_blank";
  children: NavItem[];
}

/** The locations a navigation row can occupy. */
export type NavLocation = "header" | "footer" | "sidebar" | "mobile";

/** A navigation row (GET /navigation, GET /navigation/:location). */
export interface Navigation {
  id: string;
  siteId: string;
  location: string;
  tree: NavItem[];
  createdAt: string;
  updatedAt: string;
}

/** PUT /navigation/:location body (UpsertNavigationDto). Body has ONLY `tree`. */
export interface UpsertNavigationPayload {
  tree: NavItem[];
}
