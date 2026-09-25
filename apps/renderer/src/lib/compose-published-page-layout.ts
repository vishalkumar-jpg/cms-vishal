import {
  migrate,
  wrapLayoutWithGlobalChrome,
  type SerializedLayout,
} from "@ob-cms/block-schema";

/**
 * Merge global site chrome (header/footer) into a page layout the same way admin
 * draft preview does via `usePreviewLayout`. Published routes must use this so
 * Preview and Published share one composed tree inside a single `OBSiteRoot`.
 */
export function composePublishedPageLayout(
  pageLayout: SerializedLayout,
  headerLayout: SerializedLayout | null | undefined,
  footerLayout: SerializedLayout | null | undefined,
): SerializedLayout {
  return wrapLayoutWithGlobalChrome(
    pageLayout,
    headerLayout ? migrate(headerLayout) : null,
    footerLayout ? migrate(footerLayout) : null,
  );
}

/** True when block-based global chrome replaces legacy JSON navigation shells. */
export function hasBlockGlobalChrome(
  headerLayout: SerializedLayout | null | undefined,
  footerLayout: SerializedLayout | null | undefined,
): boolean {
  return Boolean(headerLayout || footerLayout);
}
