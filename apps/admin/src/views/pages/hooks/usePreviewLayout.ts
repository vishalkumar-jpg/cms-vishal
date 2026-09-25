import * as React from "react";
import { migrate, wrapLayoutWithGlobalChrome } from "@ob-cms/block-schema";
import { useSiteChrome } from "@/views/globals/hooks/useSiteChrome";
import { useComposedPageLayout } from "./useHomepageLayout";
import type { Page } from "../types";

/** Full preview layout: homepage chrome + page body + global site header/footer. */
export function usePreviewLayout(
  page: Pick<Page, "slug" | "draftLayout" | "publishedLayout" | "layoutOptions" | "locale"> | null | undefined,
  siteId: string | null,
): { layout: ReturnType<typeof useComposedPageLayout>["layout"]; ready: boolean } {
  const { layout: composedLayout, ready: composedReady } = useComposedPageLayout(page, siteId);
  const { data: chrome, isFetched: chromeFetched } = useSiteChrome(siteId);

  const layout = React.useMemo(() => {
    if (!composedLayout) return null;
    return wrapLayoutWithGlobalChrome(
      composedLayout,
      chrome?.header ? migrate(chrome.header) : null,
      chrome?.footer ? migrate(chrome.footer) : null,
    );
  }, [composedLayout, chrome?.header, chrome?.footer]);

  return { layout, ready: composedReady && chromeFetched };
}
