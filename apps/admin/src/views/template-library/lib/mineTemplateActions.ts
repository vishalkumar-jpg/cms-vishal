/** Overflow actions for site-owned My Templates in the library. */
export type MineTemplateMenuAction = "preview" | "rename" | "duplicate" | "delete";

export type MineTemplateMenuItem = {
  action: MineTemplateMenuAction;
  label: string;
  destructive?: boolean;
};

/** Only templates owned by the active site may be managed in the library. */
export const isSiteOwnedTemplate = (
  templateSiteId: string | null | undefined,
  activeSiteId: string | null,
): boolean => Boolean(activeSiteId && templateSiteId === activeSiteId);

/** Derive a duplicate name within the API's 200-character limit. */
export const duplicateTemplateName = (name: string): string => {
  const next = `Copy of ${name}`;
  return next.length <= 200 ? next : next.slice(0, 200);
};

export const mineTemplateMenuItems = (): MineTemplateMenuItem[] => [
  { action: "preview", label: "Preview" },
  { action: "rename", label: "Rename" },
  { action: "duplicate", label: "Duplicate" },
  { action: "delete", label: "Delete", destructive: true },
];
