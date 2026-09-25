import { TEMPLATE_KIND_LABELS } from "../constants";
import type { MineKindFilter } from "./filterLibraryItems";

/** Whether any mine filter is active. */
export const mineFiltersActive = (search: string, kind: MineKindFilter): boolean =>
  search.trim() !== "" || kind !== "all";

/** Human-readable active filter summary for mine toolbar. */
export const mineFilterSummary = (search: string, kind: MineKindFilter): string | null => {
  const parts: string[] = [];
  if (kind !== "all") {
    parts.push(TEMPLATE_KIND_LABELS[kind]);
  }
  if (search.trim()) {
    parts.push(`“${search.trim()}”`);
  }
  return parts.length > 0 ? parts.join(" • ") : null;
};
