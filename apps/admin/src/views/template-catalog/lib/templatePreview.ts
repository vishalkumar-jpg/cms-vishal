import type { TemplateCatalogEntry, TemplateCatalogStatus } from "../types";

export const PREVIEW_DESCRIPTION_FALLBACK =
  "No description is available for this template.";

/** Published templates may instantiate; draft/archived may only be previewed. */
export const canUseTemplate = (status: TemplateCatalogStatus): boolean =>
  status === "published";

/** Description copy for the preview dialog (never empty). */
export const previewDescription = (description: string | null | undefined): string => {
  const trimmed = description?.trim();
  return trimmed ? trimmed : PREVIEW_DESCRIPTION_FALLBACK;
};

/** Hide the tags section when the template has no tags. */
export const hasPreviewTags = (tags: string[] | null | undefined): boolean =>
  Boolean(tags && tags.length > 0);

/** Whether a thumbnail URL should render (before load/error). */
export const hasPreviewThumbnail = (
  thumbnail: string | null | undefined,
): boolean => Boolean(thumbnail?.trim());

/** Large cover image for the preview dialog (convention-based, no API field). */
export const previewCoverUrl = (templateKey: string): string =>
  `/templates/previews/${templateKey}-cover.svg`;

/** Card thumbnail with fallback to the catalog entry thumbnail from the API. */
export const previewThumbnailUrl = (entry: Pick<TemplateCatalogEntry, "templateKey" | "thumbnail">): string =>
  entry.thumbnail?.trim() || `/templates/previews/${entry.templateKey}-thumb.svg`;

export type PreviewDialogState = {
  open: boolean;
  template: TemplateCatalogEntry | null;
};

export const openPreviewDialog = (template: TemplateCatalogEntry): PreviewDialogState => ({
  open: true,
  template,
});

export const closePreviewDialog = (): PreviewDialogState => ({
  open: false,
  template: null,
});
