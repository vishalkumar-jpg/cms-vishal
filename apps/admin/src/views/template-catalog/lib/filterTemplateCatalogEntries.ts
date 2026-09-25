import { CATEGORY_LABEL } from "./catalogLabels";
import type { TemplateCatalogCategory, TemplateCatalogEntry } from "../types";

export type StarterCatalogFilterOptions = {
  featuredOnly?: boolean;
};

/** Whether an entry matches a client-side catalog search query. */
export function catalogEntryMatchesSearch(
  entry: TemplateCatalogEntry,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (entry.displayName.toLowerCase().includes(q)) return true;
  if (entry.templateKey.toLowerCase().includes(q)) return true;
  if (entry.description.toLowerCase().includes(q)) return true;
  const categoryLabel = CATEGORY_LABEL[entry.category]?.toLowerCase();
  if (categoryLabel?.includes(q)) return true;
  return entry.tags.some((tag) => tag.toLowerCase().includes(q));
}

/** Client-side search (name/key/description/tags/category) + category + featured filters. */
export function filterTemplateCatalogEntries(
  entries: TemplateCatalogEntry[],
  search: string,
  category: TemplateCatalogCategory | "all",
  options?: StarterCatalogFilterOptions,
): TemplateCatalogEntry[] {
  return entries.filter((entry) => {
    if (options?.featuredOnly && !entry.featured) return false;
    if (category !== "all" && entry.category !== category) return false;
    return catalogEntryMatchesSearch(entry, search);
  });
}
