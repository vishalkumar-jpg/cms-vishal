import * as React from "react";
import {
  composePageWithHomepageChrome,
  HOMEPAGE_SLUG_CANDIDATES,
  isHomepageSlug,
  migrate,
  normalizePageLayoutOptions,
  type SerializedLayout,
} from "@ob-cms/block-schema";
import { ensureObHomepageNavbar } from "@ob-cms/blocks";
import { usePage, usePages } from "./usePages";
import type { Page, PageLayoutOptions } from "../types";

export interface ComposedPageLayoutResult {
  layout: SerializedLayout | null;
  /** False while the homepage layout is still loading for inheritance. */
  ready: boolean;
}

/** Find the homepage page row for a site (prefers `home`, then `ob-homepage`). */
export function findHomepagePage(
  pages: Array<Pick<Page, "id" | "slug" | "locale">>,
  locale?: string,
): Pick<Page, "id" | "slug" | "locale"> | null {
  for (const slug of HOMEPAGE_SLUG_CANDIDATES) {
    const match = pages.find((p) => p.slug === slug && (!locale || p.locale === locale));
    if (match) return match;
  }
  return null;
}

/** Load migrated layout from a homepage page row (draft, then published). */
export function layoutFromHomepagePage(
  homepagePage: Pick<Page, "draftLayout" | "publishedLayout"> | null | undefined,
): SerializedLayout | null {
  const raw = homepagePage?.draftLayout ?? homepagePage?.publishedLayout ?? null;
  return raw ? migrate(raw) : null;
}

/** Load the homepage draft layout (falls back to published). */
export function useHomepageLayout(siteId: string | null, locale?: string): SerializedLayout | null {
  const { data: pages = [] } = usePages(siteId);
  const homepage = React.useMemo(() => findHomepagePage(pages, locale), [pages, locale]);
  const { data: homepagePage } = usePage(siteId, homepage?.id ?? null);
  return React.useMemo(() => layoutFromHomepagePage(homepagePage), [homepagePage]);
}

/** Compose a page layout with inherited homepage chrome for builder/preview. */
export function useComposedPageLayout(
  page: Pick<Page, "slug" | "draftLayout" | "publishedLayout" | "layoutOptions" | "locale"> | null | undefined,
  siteId: string | null,
): ComposedPageLayoutResult {
  const { data: pages = [], isFetched: pagesFetched } = usePages(siteId);
  const homepage = React.useMemo(() => findHomepagePage(pages, page?.locale), [pages, page?.locale]);
  const { data: homepagePage, isFetched: homepageFetched } = usePage(siteId, homepage?.id ?? null);
  const homepageLayout = React.useMemo(
    () => layoutFromHomepagePage(homepagePage),
    [homepagePage],
  );

  const needsInheritance =
    !!page &&
    !isHomepageSlug(page.slug) &&
    normalizePageLayoutOptions(page.layoutOptions).inheritHomepageChrome;

  const ready = !needsInheritance || (pagesFetched && (!homepage || homepageFetched));

  const layout = React.useMemo(() => {
    const raw = page?.draftLayout ?? page?.publishedLayout ?? null;
    if (!raw || !page) return null;
    const composed = composePageWithHomepageChrome(
      migrate(raw),
      homepageLayout,
      page.layoutOptions ?? null,
      page.slug,
    );
    return isHomepageSlug(page.slug) ? ensureObHomepageNavbar(composed).layout : composed;
  }, [page, homepageLayout]);

  return { layout, ready };
}

export type { PageLayoutOptions };
