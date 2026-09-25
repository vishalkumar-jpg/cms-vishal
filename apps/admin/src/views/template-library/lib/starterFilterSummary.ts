import { CATEGORY_LABEL } from "@/views/template-catalog/lib/catalogLabels";
import type { TemplateCatalogCategory } from "@/views/template-catalog/types";
import {
  TEMPLATE_LIBRARY_FEATURED_FILTER_LABEL,
  TEMPLATE_LIBRARY_STARTER_FILTER_ALL_LABEL,
} from "../constants";

export type StarterFilterState = {
  search: string;
  category: TemplateCatalogCategory | "all";
  featuredOnly: boolean;
};

/** True when the featured shelf should render (no search or chip filters). */
export const shouldShowFeaturedShelf = (filters: StarterFilterState): boolean =>
  filters.search.trim() === "" &&
  filters.category === "all" &&
  !filters.featuredOnly;

/** Whether any starter filter is active (for empty-state actions). */
export const starterFiltersActive = (filters: StarterFilterState): boolean =>
  filters.search.trim() !== "" || filters.category !== "all" || filters.featuredOnly;

/** Human-readable active filter summary for the toolbar. */
export const starterFilterSummary = (filters: StarterFilterState): string | null => {
  const parts: string[] = [];
  if (filters.category !== "all") {
    parts.push(CATEGORY_LABEL[filters.category] ?? filters.category);
  }
  if (filters.featuredOnly) {
    parts.push(TEMPLATE_LIBRARY_FEATURED_FILTER_LABEL);
  }
  if (filters.search.trim()) {
    parts.push(`“${filters.search.trim()}”`);
  }
  return parts.length > 0 ? parts.join(" • ") : null;
};

/** Label when only the default "all starters" featured group is inactive. */
export const starterDefaultFilterLabel = (): string => TEMPLATE_LIBRARY_STARTER_FILTER_ALL_LABEL;
