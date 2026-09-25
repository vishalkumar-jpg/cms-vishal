import type { CollectionItem } from "./types";

/** Prefer the first published item for canvas preview; fall back to first draft. */
export const pickPreviewItem = (
  published?: CollectionItem[],
  draft?: CollectionItem[],
): CollectionItem | null => published?.[0] ?? draft?.[0] ?? null;
