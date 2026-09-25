import * as React from "react";
import { useSiteStore } from "@/store/siteStore";
import { usePages } from "@/views/pages/hooks/usePages";
import { pagePath, buildPagePathIndex, normalizePublicPath } from "@/views/pages/pageTree";

export interface SitePageLinkOption {
  id: string;
  title: string;
  path: string;
}

/**
 * Site-scoped page list + path helpers for builder link pickers and in-canvas navigation.
 */
export const useSitePageLinks = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const { data: pages = [], isLoading } = usePages(siteId);

  const options = React.useMemo<SitePageLinkOption[]>(
    () =>
      pages
        .map((p) => ({ id: p.id, title: p.title, path: pagePath(p, pages) }))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [pages],
  );

  const pathIndex = React.useMemo(() => buildPagePathIndex(pages), [pages]);

  const resolvePageId = React.useCallback(
    (href: string) => pathIndex.get(normalizePublicPath(href)) ?? null,
    [pathIndex],
  );

  return { pages, options, isLoading, resolvePageId };
};
