import type { TemplateLibraryMineItem, TemplateLibraryStarterItem } from "../types";

export type StarterSortId = "name-asc" | "updated-desc" | "featured";

export type MineSortId = "updated-desc" | "updated-asc" | "name-asc";

const SORT_LABEL_ALPHABETICAL = "Alphabetical";
const SORT_LABEL_RECENTLY_UPDATED = "Recently updated";

export const STARTER_SORT_OPTIONS: { id: StarterSortId; label: string }[] = [
  { id: "name-asc", label: SORT_LABEL_ALPHABETICAL },
  { id: "updated-desc", label: SORT_LABEL_RECENTLY_UPDATED },
  { id: "featured", label: "Featured first" },
];

export const MINE_SORT_OPTIONS: { id: MineSortId; label: string }[] = [
  { id: "updated-desc", label: SORT_LABEL_RECENTLY_UPDATED },
  { id: "name-asc", label: SORT_LABEL_ALPHABETICAL },
  { id: "updated-asc", label: "Oldest first" },
];

const compareName = (a: string, b: string): number => a.localeCompare(b, undefined, { sensitivity: "base" });

const compareUpdatedDesc = (a: string, b: string): number =>
  new Date(b).getTime() - new Date(a).getTime();

/** Client-side sort for starter library items (after filter). */
export const sortStarterLibraryItems = (
  items: TemplateLibraryStarterItem[],
  sort: StarterSortId,
): TemplateLibraryStarterItem[] => {
  const next = [...items];
  switch (sort) {
    case "updated-desc":
      next.sort((a, b) => compareUpdatedDesc(a.sourceData.updatedAt, b.sourceData.updatedAt));
      break;
    case "featured":
      next.sort((a, b) => {
        const af = a.metadata.featured ? 1 : 0;
        const bf = b.metadata.featured ? 1 : 0;
        if (bf !== af) return bf - af;
        return compareName(a.title, b.title);
      });
      break;
    case "name-asc":
    default:
      next.sort((a, b) => compareName(a.title, b.title));
      break;
  }
  return next;
};

/** Client-side sort for My Templates library items (after filter). */
export const sortMineLibraryItems = (
  items: TemplateLibraryMineItem[],
  sort: MineSortId,
): TemplateLibraryMineItem[] => {
  const next = [...items];
  switch (sort) {
    case "updated-asc":
      next.sort((a, b) => -compareUpdatedDesc(a.metadata.updatedAt, b.metadata.updatedAt));
      break;
    case "name-asc":
      next.sort((a, b) => compareName(a.title, b.title));
      break;
    case "updated-desc":
    default:
      next.sort((a, b) => compareUpdatedDesc(a.metadata.updatedAt, b.metadata.updatedAt));
      break;
  }
  return next;
};
