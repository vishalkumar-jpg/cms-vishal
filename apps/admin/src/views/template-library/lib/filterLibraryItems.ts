import type { TemplateKind } from "@/views/templates/types";
import type { TemplateLibraryMineItem } from "../types";
import { TEMPLATE_KIND_SEARCH_LABELS } from "../constants";

export type MineKindFilter = "all" | TemplateKind;

/** Client-side search + kind filter for My Templates. */
export function filterLibraryItems(
  items: TemplateLibraryMineItem[],
  search: string,
  kind: MineKindFilter = "all",
): TemplateLibraryMineItem[] {
  const query = search.trim().toLowerCase();
  return items.filter((item) => {
    if (kind !== "all" && item.metadata.kind !== kind) return false;
    if (!query) return true;
    if (item.title.toLowerCase().includes(query)) return true;
    if (item.description.toLowerCase().includes(query)) return true;
    if (TEMPLATE_KIND_SEARCH_LABELS[item.metadata.kind].includes(query)) return true;
    return false;
  });
}
