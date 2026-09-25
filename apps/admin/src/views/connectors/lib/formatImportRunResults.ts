import type { ImportRunSummary } from "../types";

const plural = (count: number, singular: string, pluralLabel?: string): string =>
  `${count} ${count === 1 ? singular : (pluralLabel ?? `${singular}s`)}`;

const formatKind = (
  imported: number,
  updated: number,
  singular: string,
  pluralLabel: string,
): string => {
  const parts: string[] = [];
  if (imported > 0) {
    parts.push(`${plural(imported, singular, pluralLabel)} imported`);
  }
  if (updated > 0) {
    parts.push(`${plural(updated, singular, pluralLabel)} updated`);
  }
  if (parts.length === 0) {
    return `0 ${pluralLabel}`;
  }
  return parts.join(", ");
};

/** Human-readable import run counts (includes re-import updates, not only new creates). */
export const formatImportRunResultCounts = (summary: ImportRunSummary): string => {
  const skippedCount = summary.skipped?.length ?? 0;
  const updatedPages = summary.updatedPages ?? 0;
  const updatedPosts = summary.updatedPosts ?? 0;

  const pagesPart = formatKind(summary.importedPages, updatedPages, "page", "pages");
  const postsPart = formatKind(summary.importedPosts, updatedPosts, "post", "posts");
  const base = `${pagesPart}, ${postsPart}`;
  if (skippedCount > 0) {
    return `${base} (${plural(skippedCount, "item")} skipped)`;
  }
  return base;
};
