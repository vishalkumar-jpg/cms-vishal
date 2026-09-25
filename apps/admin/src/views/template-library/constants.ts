import { resolveTemplateKind, type TemplateKind } from "@/views/templates/types";

export const TEMPLATE_LIBRARY_TITLE = "Template Library";
export const STARTER_TEMPLATES_TAB_LABEL = "Starter Templates";
export const MY_TEMPLATES_TAB_LABEL = "My Templates";

export const SAVE_AS_MY_TEMPLATE_LABEL = "Save as My Template";
export const SAVE_TO_MY_TEMPLATES_LABEL = "Save to My Templates";
export const SAVED_TO_MY_TEMPLATES_TOAST = "Saved to My Templates";
export const INSERT_IN_BUILDER_LABEL = "Insert in Builder";

export const MINE_TEMPLATE_DESCRIPTION = "Saved layout from your builder";
export const MINE_TEMPLATE_PLACEHOLDER_LABEL = "Saved layout";

export const MINE_TEMPLATE_DELETE_DESCRIPTION =
  "This removes the saved layout from My Templates.";
export const MINE_TEMPLATE_DELETE_DESCRIPTION_WITH_PAGES =
  `${MINE_TEMPLATE_DELETE_DESCRIPTION} Existing pages are not changed.`;

export const LOADING_MY_TEMPLATES_LABEL = "Loading My Templates";
export const LOADING_STARTER_TEMPLATES_LABEL = "Loading Starter Templates";

export const CLEAR_FILTERS_LABEL = "Clear filters";

export const MINE_TEMPLATES_EMPTY_PANEL =
  "No saved templates yet. Use “Save as My Template” to create one.";
export const MINE_TEMPLATES_EMPTY_LIBRARY =
  "No saved templates yet. Use “Save as My Template” in the builder to create one.";
export const MINE_TEMPLATES_EMPTY_FILTERED = "No My Templates match your search or filters.";
export const MINE_TEMPLATES_EMPTY_FILTERED_PANEL = "No templates match your search or filters.";

export const STARTER_TEMPLATES_EMPTY = "No Starter Templates are available yet.";
export const STARTER_TEMPLATES_EMPTY_FILTERED = "No Starter Templates match your filters.";

export const TEMPLATE_LIBRARY_STARTER_SEARCH_PLACEHOLDER =
  "Search by name, description, category, or tag…";

export const TEMPLATE_LIBRARY_MINE_SEARCH_PLACEHOLDER =
  "Search by name, description, or type…";

export const TEMPLATE_KIND_LABELS: Record<TemplateKind, string> = {
  page: "Page",
  section: "Section",
};

/** Lowercase labels used by client-side search matching. */
export const TEMPLATE_KIND_SEARCH_LABELS: Record<TemplateKind, string> = {
  page: TEMPLATE_KIND_LABELS.page.toLowerCase(),
  section: TEMPLATE_KIND_LABELS.section.toLowerCase(),
};

export const TEMPLATE_KIND_FILTER_ALL_LABEL = "All types";
export const TEMPLATE_LIBRARY_STARTER_FILTER_ALL_LABEL = "All starters";
export const TEMPLATE_LIBRARY_FEATURED_FILTER_LABEL = "Featured";
export const TEMPLATE_LIBRARY_SORT_LABEL = "Sort";

export const TEMPLATE_LIBRARY_SHOWING_COUNT_LABEL = "Showing";
export const TEMPLATE_LIBRARY_OF_COUNT_LABEL = "of";
export const TEMPLATE_LIBRARY_TEMPLATES_NOUN = "templates";
export const TEMPLATE_LIBRARY_FILTERS_LABEL = "Filters";
export const TEMPLATE_LIBRARY_ACTIVE_FILTERS_LABEL = "Active filters";
export const TEMPLATE_LIBRARY_FEATURED_SHELF_TITLE = "Featured starters";
export const TEMPLATE_LIBRARY_BROWSE_STARTERS_LABEL = "Browse Starter Templates";
export const VIEW_IN_MY_TEMPLATES_LABEL = "View in My Templates";

/** Builder and library cross-links — single source for route targets. */
export const TEMPLATE_LIBRARY_ROUTES = {
  starters: "/template-library",
  mine: "/template-library?tab=mine",
} as const;
export const TEMPLATE_LIBRARY_CREATE_BLANK_PAGE_LABEL = "Create blank page";
export const TEMPLATE_LIBRARY_OPEN_BUILDER_LABEL = "Open builder";
export const MINE_CARD_RENAME_HINT = "Use the menu to rename, duplicate, or delete.";
export const MINE_PREVIEW_LAYOUT_HINT =
  "Live preview of your saved layout. Insert from the builder sidebar or open a page in the builder.";

export const templateKindLabel = (kind: TemplateKind): string => TEMPLATE_KIND_LABELS[kind];

export const templateKindLabelOrDefault = (kind: TemplateKind | undefined): string =>
  templateKindLabel(resolveTemplateKind(kind));
