import { PAGE_TYPE_LABEL } from "@/views/template-catalog/lib/catalogLabels";

const LIBRARY_DATE_LOCALE = "en-US";

const UPDATED_DATE_FORMATTER = new Intl.DateTimeFormat(LIBRARY_DATE_LOCALE, {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const PREVIEW_DATE_FORMATTER = new Intl.DateTimeFormat(LIBRARY_DATE_LOCALE, {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** Short updated date for cards (e.g. "Aug 6, 2026"). */
export const formatUpdatedDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return UPDATED_DATE_FORMATTER.format(date);
};

/** Long-form date for preview dialogs. */
export const formatPreviewDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return PREVIEW_DATE_FORMATTER.format(date);
};

/** Human labels for supported page types; unknown ids pass through. */
export const formatPageTypes = (pageTypes: string[]): string =>
  pageTypes.map((type) => PAGE_TYPE_LABEL[type] ?? type).join(", ");

/** Display copy for a template registry key. */
export const templateKeyLabel = (templateKey: string): string => templateKey;

/** Visible tags with overflow count for card surfaces. */
export const summarizeTags = (
  tags: string[],
  maxVisible = 3,
): { visible: string[]; overflow: number } => {
  if (tags.length <= maxVisible) {
    return { visible: tags, overflow: 0 };
  }
  return {
    visible: tags.slice(0, maxVisible),
    overflow: tags.length - maxVisible,
  };
};

/** Max visible starter-card tags; compact featured-shelf cards show fewer. */
export const starterCardTagLimit = (compact: boolean): number => (compact ? 2 : 3);
