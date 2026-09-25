import { readModuleParams } from "./convert-module-params";
import {
  hubspotModuleStylesKeyToRole,
  hubspotStyleSettingsGroupToRole,
  DESIGN_ROLE_MODULE_ROOT,
  DESIGN_ROLE_STRUCTURAL,
} from "./hubspot-design-roles";
import { normalizeColorValue } from "../universal-design/normalize-color";
import { normalizeLengthValue } from "../universal-design/normalize-length";
import { normalizeTypographyFromFontObject } from "../universal-design/normalize-typography";
import type {
  DesignExtractionDiagnostic,
  UniversalDesignData,
  UniversalDesignLayer,
  UniversalDesignResponsiveBucket,
  UniversalDesignUnresolved,
} from "../universal-design/types";
import { UNIVERSAL_DESIGN_DATA_VERSION } from "../universal-design/types";
import type { HubspotSourceNode, JsonValue } from "./types";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isNonEmptyValue = (value: unknown): boolean => {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isPlainObject(value)) return Object.keys(value).length > 0;
  return true;
};

const HUBSPOT_DESKTOP_BUCKETS = new Set(["default", "desktop"]);
const HUBSPOT_TABLET_BUCKETS = new Set(["tablet"]);
const HUBSPOT_MOBILE_BUCKETS = new Set(["mobile"]);
const HUBSPOT_LARGE_DESKTOP_BUCKETS = new Set(["desktop_lg", "largeDesktop"]);

const mapHubspotBucket = (key: string): UniversalDesignResponsiveBucket | "desktop" | undefined => {
  if (HUBSPOT_DESKTOP_BUCKETS.has(key)) return "desktop";
  if (HUBSPOT_TABLET_BUCKETS.has(key)) return "tablet";
  if (HUBSPOT_MOBILE_BUCKETS.has(key)) return "mobile";
  if (HUBSPOT_LARGE_DESKTOP_BUCKETS.has(key)) return "largeDesktop";
  return undefined;
};

const emptyLayer = (): UniversalDesignLayer => ({});

const mergeLayer = (target: UniversalDesignLayer, source: UniversalDesignLayer): UniversalDesignLayer => {
  const out: UniversalDesignLayer = { ...target, ...source };
  if (target.typography || source.typography) {
    out.typography = { ...target.typography, ...source.typography };
  }
  if (target.colors || source.colors) {
    out.colors = { ...target.colors, ...source.colors };
  }
  if (target.spacing || source.spacing) {
    out.spacing = { ...target.spacing, ...source.spacing };
  }
  if (target.layout || source.layout) {
    out.layout = { ...target.layout, ...source.layout };
  }
  if (target.visibility || source.visibility) {
    out.visibility = { ...target.visibility, ...source.visibility };
  }
  if (target.extensions || source.extensions) {
    out.extensions = { ...target.extensions, ...source.extensions };
  }
  return out;
};

const horizontalAlignToCss = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const v = value.trim().toUpperCase();
  if (v === "CENTER") return "center";
  if (v === "LEFT") return "left";
  if (v === "RIGHT") return "right";
  return value.trim().toLowerCase();
};

const extractAlignFromObject = (obj: unknown): UniversalDesignLayer => {
  if (!isPlainObject(obj)) return emptyLayer();
  const layer = emptyLayer();
  const align = obj.horizontal_align ?? obj.horizontalAlign;
  const textAlign = horizontalAlignToCss(align);
  if (textAlign) layer.layout = { textAlign };
  if (typeof obj.css === "string" && obj.css.trim()) {
    layer.effects = { rawCss: obj.css.trim() };
  }
  return layer;
};

const extractVisibilityLayer = (obj: unknown): UniversalDesignLayer => {
  if (!isPlainObject(obj)) return emptyLayer();
  const layer = emptyLayer();
  layer.visibility = {
    hiddenDesktop: obj.hidden_desktop === true,
    hiddenTablet: obj.hidden_tablet === true,
    hiddenMobile: obj.hidden_mobile === true,
    zIndex: typeof obj.z_index === "number" ? obj.z_index : undefined,
  };
  return layer;
};

const extractGridLayer = (obj: unknown): UniversalDesignLayer => {
  if (!isPlainObject(obj)) return emptyLayer();
  const layer = emptyLayer();
  const layout: Record<string, unknown> = {};
  if (typeof obj.columns === "number") layout.columns = obj.columns;
  if (obj.gap != null) {
    const gap = normalizeLengthValue(obj.gap);
    if (gap) layer.spacing = { gap };
  }
  if (isPlainObject(obj.align)) {
    const alignLayer = extractAlignFromObject(obj.align);
    if (alignLayer.layout?.textAlign) layout.textAlign = alignLayer.layout.textAlign;
  }
  if (Object.keys(layout).length > 0) layer.layout = layout as UniversalDesignLayer["layout"];
  return layer;
};

const extractSpacingFields = (obj: unknown, prefix: string): UniversalDesignLayer => {
  if (!isPlainObject(obj)) return emptyLayer();
  const layer = emptyLayer();
  const spacing: Record<string, unknown> = {};
  const map: Record<string, string> = {
    section_padding_top: "paddingTop",
    section_padding_bottom: "paddingBottom",
    section_padding_left: "paddingLeft",
    section_padding_right: "paddingRight",
    steps_gap: "gap",
    button_padding_x: "paddingLeft",
    button_padding_y: "paddingTop",
  };
  for (const [hubKey, uddKey] of Object.entries(map)) {
    if (obj[hubKey] != null) {
      const len = normalizeLengthValue(obj[hubKey]);
      if (len) spacing[uddKey] = len;
    }
  }
  if (obj.button_padding_x != null) {
    const len = normalizeLengthValue(obj.button_padding_x);
    if (len) {
      spacing.paddingLeft = len;
      spacing.paddingRight = len;
    }
  }
  if (prefix === "spacing_mobile" && isPlainObject(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      const len = normalizeLengthValue(v);
      if (len) spacing[k] = len;
    }
  }
  if (Object.keys(spacing).length > 0) layer.spacing = spacing as UniversalDesignLayer["spacing"];
  return layer;
};

const extractThemeClassExtensions = (obj: unknown): UniversalDesignLayer => {
  if (!isPlainObject(obj)) return emptyLayer();
  const names: string[] = [];
  for (const key of ["color_theme", "size", "styles"]) {
    const val = obj[key];
    if (typeof val === "string" && val.trim()) names.push(val.trim());
  }
  if (names.length === 0) return emptyLayer();
  return { extensions: { themeClassNames: names } };
};

const extractTypographyPart = (obj: unknown): UniversalDesignLayer => {
  if (!isPlainObject(obj)) return emptyLayer();
  let layer = emptyLayer();
  if (obj.custom_font) {
    const typography = normalizeTypographyFromFontObject(obj.custom_font);
    if (typography) layer.typography = typography;
  }
  if (obj.appearance && typeof obj.appearance === "string") {
    layer.extensions = { appearancePreset: obj.appearance };
  }
  const spacingLayer = extractSpacingFields(obj, "part");
  layer = mergeLayer(layer, spacingLayer);
  const classLayer = extractThemeClassExtensions(obj);
  layer = mergeLayer(layer, classLayer);
  return layer;
};

const extractFlatStylesObject = (obj: Record<string, unknown>): UniversalDesignLayer => {
  let layer = emptyLayer();
  if (obj.gap != null) {
    const gap = normalizeLengthValue(obj.gap);
    if (gap) layer.spacing = { gap };
  }
  for (const [key, value] of Object.entries(obj)) {
    if (key === "gap") continue;
    if (key === "visibility") layer = mergeLayer(layer, extractVisibilityLayer(value));
    else if (key === "layout") layer = mergeLayer(layer, extractSpacingFields(value, "layout"));
    else if (typeof value === "string" && (key === "color_theme" || key === "size")) {
      layer = mergeLayer(layer, extractThemeClassExtensions({ [key]: value }));
    }
  }
  return layer;
};

export const hubspotDesignEntryKey = (hubspotLocator: string, role: string): string =>
  `${hubspotLocator}::${role}`;

export interface HubspotDesignEntry {
  entryKey: string;
  hubspotLocator: string;
  role: string;
  data: UniversalDesignData;
}

const createEntry = (
  hubspotLocator: string,
  role: string,
  desktop: UniversalDesignLayer,
  responsive?: UniversalDesignData["responsive"],
  unresolved?: UniversalDesignUnresolved[],
): HubspotDesignEntry => ({
  entryKey: hubspotDesignEntryKey(hubspotLocator, role),
  hubspotLocator,
  role,
  data: {
    version: UNIVERSAL_DESIGN_DATA_VERSION,
    role,
    desktop,
    responsive,
    unresolved,
  },
});

const extractBreakpointTree = (
  hubspotLocator: string,
  role: string,
  obj: unknown,
  extractLeaf: (value: unknown) => UniversalDesignLayer,
): HubspotDesignEntry | null => {
  if (!isPlainObject(obj)) {
    const leaf = extractLeaf(obj);
    if (Object.keys(leaf).length === 0) return null;
    return createEntry(hubspotLocator, role, leaf);
  }

  let desktop = emptyLayer();
  const responsive: NonNullable<UniversalDesignData["responsive"]> = {};
  let hasResponsive = false;

  for (const [key, value] of Object.entries(obj)) {
    const bucket = mapHubspotBucket(key);
    if (bucket && bucket !== "desktop") {
      const layer = extractLeaf(value);
      if (Object.keys(layer).length > 0) {
        responsive[bucket] = mergeLayer(responsive[bucket] ?? emptyLayer(), layer);
        hasResponsive = true;
      }
      continue;
    }
    if (bucket === "desktop" || key === "vertical" || !mapHubspotBucket(key)) {
      const layer = extractLeaf(value);
      desktop = mergeLayer(desktop, layer);
    }
  }

  if (Object.keys(desktop).length === 0 && !hasResponsive) {
    const direct = extractLeaf(obj);
    if (Object.keys(direct).length === 0) return null;
    desktop = direct;
  }

  if (Object.keys(desktop).length === 0 && !hasResponsive) return null;
  return createEntry(hubspotLocator, role, desktop, hasResponsive ? responsive : undefined);
};

const extractModuleStylesTree = (
  styles: Record<string, unknown>,
  hubspotLocator: string,
): HubspotDesignEntry[] => {
  const entries: HubspotDesignEntry[] = [];
  const rootLayer = extractFlatStylesObject(styles);
  if (Object.keys(rootLayer).length > 0) {
    entries.push(createEntry(hubspotLocator, DESIGN_ROLE_MODULE_ROOT, rootLayer));
  }

  for (const [key, value] of Object.entries(styles)) {
    if (!isNonEmptyValue(value)) continue;
    const role = hubspotModuleStylesKeyToRole(key);
    const partLocator = `${hubspotLocator}.${key}`;
    if (key === "visibility") {
      const entry = extractBreakpointTree(partLocator, role, value, extractVisibilityLayer);
      if (entry) entries.push(entry);
      continue;
    }
    if (key === "alignment" || key === "text_alignment") {
      const entry = extractBreakpointTree(partLocator, role, value, extractAlignFromObject);
      if (entry) entries.push(entry);
      continue;
    }
    if (key === "grid") {
      const entry = extractBreakpointTree(partLocator, role, value, extractGridLayer);
      if (entry) entries.push(entry);
      continue;
    }
    if (key === "layout") {
      const entry = extractBreakpointTree(partLocator, role, value, (v) =>
        extractSpacingFields(v, "layout"),
      );
      if (entry) entries.push(entry);
      continue;
    }
    if (isPlainObject(value) && (value.custom_font || value.appearance || value.spacing_mobile)) {
      const desktop = extractTypographyPart(value);
      const responsive: NonNullable<UniversalDesignData["responsive"]> = {};
      if (isPlainObject(value.spacing_mobile) && Object.keys(value.spacing_mobile).length > 0) {
        responsive.mobile = extractSpacingFields(value.spacing_mobile, "spacing_mobile");
      }
      entries.push(
        createEntry(
          partLocator,
          role,
          desktop,
          Object.keys(responsive).length > 0 ? responsive : undefined,
        ),
      );
      continue;
    }
    if (isPlainObject(value)) {
      const entry = extractBreakpointTree(partLocator, role, value, extractTypographyPart);
      if (entry) entries.push(entry);
    }
  }

  return entries;
};

const extractStyleSettings = (
  styleSettings: Record<string, unknown>,
  hubspotLocator: string,
): HubspotDesignEntry[] => {
  const entries: HubspotDesignEntry[] = [];
  for (const [group, groupValue] of Object.entries(styleSettings)) {
    if (!isPlainObject(groupValue)) continue;
    for (const [field, fieldValue] of Object.entries(groupValue)) {
      const role = hubspotStyleSettingsGroupToRole(group, field);
      const fieldLocator = `${hubspotLocator}.${group}.${field}`;
      let desktop = emptyLayer();
      if (field.endsWith("_color") || field.endsWith("_bg_color") || field.includes("color")) {
        const color = normalizeColorValue(fieldValue);
        if (color) {
          if (field.includes("text") && !field.includes("background")) {
            desktop.colors = { text: color };
          } else {
            desktop.colors = { background: color };
          }
        }
      } else if (field.includes("font") && isPlainObject(fieldValue)) {
        const typography = normalizeTypographyFromFontObject(fieldValue);
        if (typography) desktop.typography = typography;
      } else if (field.includes("radius") || field.includes("size") || field.includes("padding") || field.includes("gap") || field.includes("width")) {
        desktop = mergeLayer(desktop, extractSpacingFields({ [field]: fieldValue }, field));
        const len = normalizeLengthValue(fieldValue);
        if (len && field.includes("radius")) desktop.borders = { radius: len };
        if (len && field.includes("width") && !field.includes("padding")) desktop.sizing = { width: len };
      } else if (isPlainObject(fieldValue)) {
        desktop = extractTypographyPart(fieldValue);
        if (Object.keys(desktop).length === 0) {
          desktop = extractSpacingFields(fieldValue, field);
        }
      }
      if (Object.keys(desktop).length > 0) {
        entries.push(createEntry(fieldLocator, role, desktop));
      } else if (isNonEmptyValue(fieldValue)) {
        entries.push(
          createEntry(fieldLocator, role, emptyLayer(), undefined, [
            {
              code: "DESIGN_UNMAPPED_FIELD",
              message: "Style setting preserved in lossless slice; no normalized layer yet.",
              detail: `${group}.${field}`,
            },
          ]),
        );
      }
    }
  }
  return entries;
};

const extractAnimationExtension = (
  animation: unknown,
  hubspotLocator: string,
): HubspotDesignEntry | null => {
  if (!isNonEmptyValue(animation)) return null;
  return createEntry(hubspotLocator, DESIGN_ROLE_MODULE_ROOT, {
    extensions: { motion: animation },
  });
};

const extractStructuralPresentation = (
  payload: JsonValue,
  hubspotLocator: string,
): HubspotDesignEntry[] => {
  if (!isPlainObject(payload)) return [];
  const entries: HubspotDesignEntry[] = [];
  const extensions: UniversalDesignLayer["extensions"] = {};
  const themeClassNames: string[] = [];
  if (typeof payload.cssClass === "string" && payload.cssClass.trim()) {
    themeClassNames.push(payload.cssClass.trim());
  }
  if (typeof payload.css_class === "string" && payload.css_class.trim()) {
    themeClassNames.push(payload.css_class.trim());
  }
  if (themeClassNames.length > 0) extensions.themeClassNames = themeClassNames;
  if (typeof payload.cssStyle === "string" && payload.cssStyle.trim()) {
    entries.push(
      createEntry(hubspotLocator, DESIGN_ROLE_STRUCTURAL, {
        effects: { rawCss: payload.cssStyle.trim() },
        extensions,
      }),
    );
    return entries;
  }
  if (typeof payload.css_style === "string" && payload.css_style.trim()) {
    entries.push(
      createEntry(hubspotLocator, DESIGN_ROLE_STRUCTURAL, {
        effects: { rawCss: payload.css_style.trim() },
        extensions,
      }),
    );
    return entries;
  }
  if (themeClassNames.length > 0) {
    entries.push(createEntry(hubspotLocator, DESIGN_ROLE_STRUCTURAL, { extensions }));
  }
  return entries;
};

const pushLosslessSlice = (
  slices: HubspotDesignLosslessSlice[],
  locator: string,
  raw: JsonValue,
): void => {
  if (!isNonEmptyValue(raw)) return;
  if (!slices.some((s) => s.locator === locator)) {
    slices.push({ locator, raw });
  }
};

const captureObjectDesignLossless = (
  obj: Record<string, unknown>,
  locator: string,
  slices: HubspotDesignLosslessSlice[],
): void => {
  if (isPlainObject(obj.custom_font)) {
    pushLosslessSlice(slices, `${locator}.custom_font`, obj.custom_font as JsonValue);
  }
  for (const key of ["css", "child_css"] as const) {
    if (key in obj) pushLosslessSlice(slices, `${locator}.${key}`, obj[key] as JsonValue);
  }
  for (const key of ["cssClass", "css_class", "cssStyle", "css_style"] as const) {
    if (typeof obj[key] === "string" && obj[key].trim()) {
      pushLosslessSlice(slices, `${locator}.${key}`, obj[key] as JsonValue);
    }
  }
};

export interface HubspotDesignLosslessSlice {
  locator: string;
  raw: JsonValue;
}

export interface HubspotNodeDesignExtraction {
  entries: HubspotDesignEntry[];
  losslessSlices: HubspotDesignLosslessSlice[];
  diagnostics: DesignExtractionDiagnostic[];
}

const walkForNestedStyles = (
  value: unknown,
  locator: string,
  slices: HubspotDesignLosslessSlice[],
  entries: HubspotDesignEntry[],
): void => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkForNestedStyles(item, `${locator}[${index}]`, slices, entries));
    return;
  }
  if (!isPlainObject(value)) return;

  captureObjectDesignLossless(value, locator, slices);
  entries.push(...extractStructuralPresentation(value as JsonValue, locator));

  if (isNonEmptyValue(value.styles) && isPlainObject(value.styles)) {
    const stylesLocator = `${locator}.styles`;
    pushLosslessSlice(slices, stylesLocator, value.styles as JsonValue);
    entries.push(...extractModuleStylesTree(value.styles, stylesLocator));
    for (const [styleKey, styleValue] of Object.entries(value.styles)) {
      if (isPlainObject(styleValue) || Array.isArray(styleValue)) {
        walkForNestedStyles(styleValue, `${stylesLocator}.${styleKey}`, slices, entries);
      }
    }
  } else if (isNonEmptyValue(value.styles)) {
    pushLosslessSlice(slices, `${locator}.styles`, value.styles as JsonValue);
  }
  if (isNonEmptyValue(value.style_settings) && isPlainObject(value.style_settings)) {
    const settingsLocator = `${locator}.style_settings`;
    pushLosslessSlice(slices, settingsLocator, value.style_settings as JsonValue);
    entries.push(...extractStyleSettings(value.style_settings, settingsLocator));
    for (const [groupKey, groupValue] of Object.entries(value.style_settings)) {
      if (isPlainObject(groupValue)) {
        walkForNestedStyles(groupValue, `${settingsLocator}.${groupKey}`, slices, entries);
      }
    }
  }
  if (isNonEmptyValue(value.animation)) {
    pushLosslessSlice(slices, `${locator}.animation`, value.animation as JsonValue);
    const motionEntry = extractAnimationExtension(value.animation, `${locator}.animation`);
    if (motionEntry) entries.push(motionEntry);
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === "styles" || key === "style_settings" || key === "animation") continue;
    if (isPlainObject(child) || Array.isArray(child)) {
      walkForNestedStyles(child, `${locator}.${key}`, slices, entries);
    }
  }
};

/** HubSpot-specific: extract UDD entries + lossless slices from a source node payload. */
export const extractHubspotDesignFromSourceNode = (
  node: HubspotSourceNode,
): HubspotNodeDesignExtraction => {
  const diagnostics: DesignExtractionDiagnostic[] = [];
  const entries: HubspotDesignEntry[] = [];
  const losslessSlices: HubspotDesignLosslessSlice[] = [];

  const nestedParams = readModuleParams(node.payload);
  if (nestedParams !== undefined && nestedParams !== node.payload) {
    if (isPlainObject(node.payload)) {
      captureObjectDesignLossless(node.payload, "payload", losslessSlices);
    }
    entries.push(...extractStructuralPresentation(node.payload, "payload"));
    walkForNestedStyles(nestedParams, "params", losslessSlices, entries);
  } else if (isPlainObject(node.payload)) {
    walkForNestedStyles(node.payload, "payload", losslessSlices, entries);
  }

  const deduped = new Map<string, HubspotDesignEntry>();
  for (const entry of entries) {
    const existing = deduped.get(entry.entryKey);
    if (!existing) {
      deduped.set(entry.entryKey, entry);
      continue;
    }
    deduped.set(entry.entryKey, {
      ...entry,
      data: {
        ...existing.data,
        desktop: mergeLayer(existing.data.desktop, entry.data.desktop),
        responsive: entry.data.responsive ?? existing.data.responsive,
        unresolved: [...(existing.data.unresolved ?? []), ...(entry.data.unresolved ?? [])],
      },
    });
  }

  return {
    entries: [...deduped.values()].sort((a, b) => a.entryKey.localeCompare(b.entryKey)),
    losslessSlices: losslessSlices.sort((a, b) => a.locator.localeCompare(b.locator)),
    diagnostics,
  };
};
