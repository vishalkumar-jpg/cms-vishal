import type { SerializedLayout } from "@ob-cms/block-schema";
import type { AutoFix } from "../types";

/**
 * `font-display` — web fonts should load with `font-display: swap` so text is
 * visible immediately (no invisible-text FOIT). Unlike image fixes, this is NOT
 * a page-draft edit: font loading is configured at the site/theme level, not on
 * individual page blocks. So this fix is `manual` — it detects + explains the
 * remediation but does not mutate the page draft. Wiring an automatic apply
 * (site theme font config) is tracked as Phase 2 follow-up.
 */
export const fontDisplayFix: AutoFix = {
  ruleId: "font-display",
  category: "manual",
  title: "Use font-display: swap",
  description:
    "Ensure web fonts use font-display: swap so text renders immediately while fonts load. This is configured in the site's theme font settings, not on the page — apply it there.",

  plan(layout: SerializedLayout) {
    // Manual: no safe automatic edit on the page draft.
    return { changes: [], layout };
  },
};
