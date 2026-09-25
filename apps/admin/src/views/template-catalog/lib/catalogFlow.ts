import { canUseTemplate } from "./templatePreview";
import type { TemplateCatalogEntry } from "../types";

/** Builder path after a successful create-from-template. */
export const builderPathForPage = (pageId: string): string => `/pages/${pageId}/builder`;

/**
 * Whether Preview → Use Template may open the create dialog for this entry.
 * Draft/archived templates can be previewed but not used.
 */
export const canProceedFromPreviewToUse = (
  template: TemplateCatalogEntry | null | undefined,
): boolean => Boolean(template && canUseTemplate(template.status));
