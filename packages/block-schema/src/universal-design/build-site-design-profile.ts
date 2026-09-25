import type { SiteDesignProfile, UniversalDesignData } from "./types";
import { UNIVERSAL_DESIGN_DATA_VERSION } from "./types";
import { colorToCssString } from "./normalize-color";

const pushUnique = (list: string[], value: string | undefined): void => {
  if (!value) return;
  const normalized = value.trim();
  if (!normalized || list.includes(normalized)) return;
  list.push(normalized);
};

const collectFromLayer = (
  colors: string[],
  fontFamilies: string[],
  themeClassNames: string[],
  layer: UniversalDesignData["desktop"],
): void => {
  if (layer.typography?.fontFamily) pushUnique(fontFamilies, layer.typography.fontFamily);
  if (layer.typography?.color) pushUnique(colors, colorToCssString(layer.typography.color));
  if (layer.colors?.text) pushUnique(colors, colorToCssString(layer.colors.text));
  if (layer.colors?.background) pushUnique(colors, colorToCssString(layer.colors.background));
  if (layer.colors?.border) pushUnique(colors, colorToCssString(layer.colors.border));
  if (layer.borders?.color) pushUnique(colors, colorToCssString(layer.borders.color));
  if (layer.extensions?.themeClassNames) {
    for (const name of layer.extensions.themeClassNames) pushUnique(themeClassNames, name);
  }
};

/** Deterministic site design profile from normalized entries (in-memory; Phase J persists). */
export const buildSiteDesignProfile = (entries: UniversalDesignData[]): SiteDesignProfile => {
  const colors: string[] = [];
  const fontFamilies: string[] = [];
  const themeClassNames: string[] = [];

  const sorted = [...entries].sort((a, b) => a.role.localeCompare(b.role));
  for (const entry of sorted) {
    collectFromLayer(colors, fontFamilies, themeClassNames, entry.desktop);
    if (entry.responsive) {
      for (const layer of Object.values(entry.responsive)) {
        collectFromLayer(colors, fontFamilies, themeClassNames, layer);
      }
    }
  }

  colors.sort();
  fontFamilies.sort();
  themeClassNames.sort();

  return {
    version: UNIVERSAL_DESIGN_DATA_VERSION,
    colors,
    fontFamilies,
    themeClassNames,
  };
};
