import type { PageSummary } from "./types";

/** The slug the public renderer maps to `/` (home-page convention). */
export const HOME_SLUG = "home";

/** True when a page is the site's home page (slug === "home"). */
export const isHomePage = (page: { slug: string }): boolean => page.slug === HOME_SLUG;

/**
 * Resolve a page's public path from its parent chain. Home (`slug === "home"`)
 * resolves to `/`. Otherwise the path is the slash-joined slug chain of the
 * page and its ancestors, e.g. parent `about` + child `team` → `/about/team`.
 * Cycles are guarded against.
 */
export const pagePath = <T extends { id: string; slug: string; parentId: string | null }>(
  page: T,
  all: T[],
): string => {
  if (isHomePage(page)) return "/";
  const byId = new Map(all.map((p) => [p.id, p]));
  const segments: string[] = [];
  const seen = new Set<string>();
  let current: T | undefined = page;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (isHomePage(current)) break; // a home ancestor contributes no segment
    segments.unshift(current.slug);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return `/${segments.join("/")}`;
};

export const normalizePublicPath = (path: string): string =>
  path === "" || path === "/"
    ? "/"
    : path.startsWith("/")
      ? path.replace(/\/+$/, "") || "/"
      : `/${path.replace(/^\/+/, "")}`;

/** Map public path → page id (O(n) build, O(1) lookup). */
export const buildPagePathIndex = <T extends { id: string; slug: string; parentId: string | null }>(
  all: T[],
): Map<string, string> => {
  const index = new Map<string, string>();
  for (const page of all) {
    index.set(pagePath(page, all), page.id);
  }
  return index;
};

/** Find a page id for a public path (e.g. `/about`, `/how-it-works`). */
export const pageIdFromPath = <T extends { id: string; slug: string; parentId: string | null }>(
  path: string,
  all: T[],
): string | null => {
  const normalized = normalizePublicPath(path);
  return buildPagePathIndex(all).get(normalized) ?? null;
};

export interface PageTreeNode<T> {
  page: T;
  depth: number;
  children: PageTreeNode<T>[];
}

/**
 * Build an indented tree from a flat page list using `parentId`. Orphans (parent
 * not in the list) are treated as roots. Returns a depth-annotated flat list in
 * render order plus the nested structure.
 */
export const buildPageTree = <
  T extends { id: string; parentId: string | null; title: string },
>(
  pages: T[],
): { flat: PageTreeNode<T>[]; roots: PageTreeNode<T>[] } => {
  const byParent = new Map<string | null, T[]>();
  const ids = new Set(pages.map((p) => p.id));
  for (const p of pages) {
    const key = p.parentId && ids.has(p.parentId) ? p.parentId : null;
    const list = byParent.get(key) ?? [];
    list.push(p);
    byParent.set(key, list);
  }
  const flat: PageTreeNode<T>[] = [];
  const build = (parentId: string | null, depth: number): PageTreeNode<T>[] => {
    const kids = (byParent.get(parentId) ?? []).sort((a, b) =>
      a.title.localeCompare(b.title),
    );
    return kids.map((page) => {
      const node: PageTreeNode<T> = { page, depth, children: [] };
      flat.push(node);
      node.children = build(page.id, depth + 1);
      return node;
    });
  };
  const roots = build(null, 0);
  return { flat, roots };
};

/** Pages eligible to be a parent of `pageId` (excludes itself + descendants). */
export const eligibleParents = <
  T extends { id: string; parentId: string | null; title: string },
>(
  pages: T[],
  pageId: string,
): T[] => {
  const descendants = new Set<string>([pageId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of pages) {
      if (p.parentId && descendants.has(p.parentId) && !descendants.has(p.id)) {
        descendants.add(p.id);
        changed = true;
      }
    }
  }
  return pages.filter((p) => !descendants.has(p.id));
};

export type { PageSummary };
