import { builderPathForPage } from "@/views/template-catalog/lib/catalogFlow";

export const BUILDER_PANEL_PARAM = "panel";

const storageKey = (siteId: string): string => `ob-cms:last-builder-page:${siteId}`;

/** Remember the most recently opened builder page for a site (session-scoped). */
export const rememberLastBuilderPage = (siteId: string, pageId: string): void => {
  try {
    sessionStorage.setItem(storageKey(siteId), pageId);
  } catch {
    // sessionStorage unavailable — skip quietly
  }
};

export const getLastBuilderPageId = (siteId: string): string | null => {
  try {
    return sessionStorage.getItem(storageKey(siteId));
  } catch {
    return null;
  }
};

/** Builder route with optional sidebar panel query (e.g. panel=templates). */
export const builderPathWithPanel = (pageId: string, panel?: string): string => {
  const base = builderPathForPage(pageId);
  if (!panel) return base;
  return `${base}?${BUILDER_PANEL_PARAM}=${encodeURIComponent(panel)}`;
};

/** Resolve insert-in-builder target: last session page or null. */
export const resolveInsertInBuilderPath = (siteId: string): string | null => {
  const pageId = getLastBuilderPageId(siteId);
  if (!pageId) return null;
  return builderPathWithPanel(pageId, "templates");
};
