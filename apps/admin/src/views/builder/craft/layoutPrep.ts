import type { SerializedLayout } from "@ob-cms/block-schema";
import { layoutToCraft } from "./serialize";

/** In-memory cache so reopening the same page skips layoutToCraft (large OB pages). */
const craftJsonCache = new Map<string, string>();
const MAX_CRAFT_JSON_CACHE = 24;

const LAYOUT_PREP_VERSION = 6;

const cacheKey = (pageId: string, updatedAt: string): string =>
  `${LAYOUT_PREP_VERSION}:${pageId}:${updatedAt}`;

/**
 * Convert SerializedLayout → Craft JSON off the critical path (yields one frame
 * so the loading UI can paint before heavy migrate/repair on huge layouts).
 */
export const prepareCraftJson = (
  pageId: string,
  updatedAt: string,
  layout: SerializedLayout,
): Promise<string | null> => {
  const key = cacheKey(pageId, updatedAt);
  const cached = craftJsonCache.get(key);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve) => {
    window.setTimeout(() => {
      try {
        const json = JSON.stringify(layoutToCraft(layout));
        if (craftJsonCache.size >= MAX_CRAFT_JSON_CACHE) {
          const oldest = craftJsonCache.keys().next().value;
          if (oldest) craftJsonCache.delete(oldest);
        }
        craftJsonCache.set(key, json);
        resolve(json);
      } catch {
        resolve(null);
      }
    }, 0);
  });
};

/** Warm the builder JS chunks before navigation (call from Pages list on hover). */
export const prefetchBuilderBundle = (): void => {
  void import("@/views/builder/Builder");
};
