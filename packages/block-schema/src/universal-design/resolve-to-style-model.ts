import type { StyleModel } from "../styles";
import { safeColorForStyleModel } from "./normalize-color";
import type { NormalizedColor } from "./types";
import type {
  NormalizedTypography,
  ResolvedUniversalDesign,
  UniversalDesignData,
  UniversalDesignLayer,
  UniversalDesignUnresolved,
} from "./types";

export const DESIGN_RAW_CSS_INERT = "DESIGN_RAW_CSS_INERT";
export const DESIGN_RAW_COLOR_CSS_INERT = "DESIGN_RAW_COLOR_CSS_INERT";

const isNonEmptyObject = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;

const lengthToCss = (len: { value: number; unit: string } | undefined): string | undefined =>
  len != null ? `${len.value}${len.unit}` : undefined;

const recordInertColor = (
  color: NormalizedColor | undefined,
  unresolved: UniversalDesignUnresolved[],
  detail: string,
): void => {
  if (!color) return;
  if (safeColorForStyleModel(color)) return;
  if (color.hex || color.rgb || color.css) {
    unresolved.push({
      code: DESIGN_RAW_COLOR_CSS_INERT,
      message: "Non-parseable color preserved on UDD; not applied to StyleModel.",
      detail,
    });
  }
};

const applyLayerColor = (
  color: NormalizedColor | undefined,
  styleKey: "textColor" | "backgroundColor",
  colorsSection: Record<string, unknown>,
  unresolved: UniversalDesignUnresolved[],
  detail: string,
): void => {
  const safe = safeColorForStyleModel(color);
  if (safe) colorsSection[styleKey] = safe;
  else recordInertColor(color, unresolved, detail);
};

const typographyToStyleSections = (
  typography: NormalizedTypography | undefined,
  unresolved: UniversalDesignUnresolved[],
): Pick<StyleModel, "typography" | "colors"> => {
  if (!typography) return {};
  const typographySection: Record<string, unknown> = {};
  if (typography.fontFamily) typographySection.fontFamily = typography.fontFamily;
  if (typography.fontSize) typographySection.fontSize = lengthToCss(typography.fontSize);
  if (typography.fontWeight != null) typographySection.fontWeight = typography.fontWeight;
  if (typography.lineHeight != null) typographySection.lineHeight = typography.lineHeight;
  if (typography.letterSpacing) typographySection.letterSpacing = lengthToCss(typography.letterSpacing);
  if (typography.textAlign) typographySection.textAlign = typography.textAlign;
  if (typography.fontStyle) typographySection.fontStyle = typography.fontStyle;
  if (typography.textDecoration) typographySection.textDecoration = typography.textDecoration;
  if (typography.bold === true && typographySection.fontWeight == null) typographySection.fontWeight = 700;
  if (typography.italic === true && typographySection.fontStyle == null) typographySection.fontStyle = "italic";
  if (typography.underline === true && typographySection.textDecoration == null) {
    typographySection.textDecoration = "underline";
  }

  const colorsSection: Record<string, unknown> = {};
  applyLayerColor(typography.color, "textColor", colorsSection, unresolved, "typography.color");

  return {
    ...(isNonEmptyObject(typographySection) ? { typography: typographySection } : {}),
    ...(isNonEmptyObject(colorsSection) ? { colors: colorsSection } : {}),
  };
};

const STYLE_MODEL_SECTION_KEYS = [
  "layout",
  "spacing",
  "sizing",
  "typography",
  "colors",
  "borders",
  "shadows",
  "effects",
  "position",
  "advanced",
] as const satisfies readonly (keyof StyleModel)[];

/** Overlay keys with explicit `undefined` must not erase defined base section values. */
const definedStyleSectionOverlay = (overlaySection: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(overlaySection).filter(([, value]) => value !== undefined));

const mergeStyleModelSectionRecords = (
  baseSection: Record<string, unknown> | undefined,
  overlaySection: Record<string, unknown>,
): Record<string, unknown> => ({
  ...(baseSection ?? {}),
  ...definedStyleSectionOverlay(overlaySection),
});

const mergeStyleModelSections = (base: StyleModel, overlay: StyleModel): StyleModel => {
  const merged: StyleModel = { ...base };
  for (const key of STYLE_MODEL_SECTION_KEYS) {
    const baseSection = merged[key];
    const overlaySection = overlay[key];
    if (overlaySection == null) continue;
    if (typeof overlaySection === "object" && !Array.isArray(overlaySection)) {
      merged[key] = mergeStyleModelSectionRecords(
        baseSection as Record<string, unknown> | undefined,
        overlaySection as Record<string, unknown>,
      ) as StyleModel[typeof key];
    } else {
      merged[key] = overlaySection;
    }
  }
  return merged;
};

const layerToStyleModel = (
  layer: UniversalDesignLayer,
  unresolved: UniversalDesignUnresolved[],
): StyleModel => {
  const model: StyleModel = {};
  Object.assign(model, typographyToStyleSections(layer.typography, unresolved));

  if (layer.colors) {
    const colorsSection: Record<string, unknown> = {
      ...((model.colors as Record<string, unknown>) ?? {}),
    };
    applyLayerColor(layer.colors.text, "textColor", colorsSection, unresolved, "colors.text");
    applyLayerColor(layer.colors.background, "backgroundColor", colorsSection, unresolved, "colors.background");
    if (isNonEmptyObject(colorsSection)) model.colors = colorsSection;

    const border = safeColorForStyleModel(layer.colors.border);
    if (border) {
      model.borders = { ...(model.borders as object), borderColor: border };
    } else {
      recordInertColor(layer.colors.border, unresolved, "colors.border");
    }
  }

  if (layer.spacing && isNonEmptyObject(layer.spacing)) {
    const spacing: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(layer.spacing)) {
      const css = lengthToCss(val as { value: number; unit: string });
      if (css) spacing[key] = css;
    }
    if (isNonEmptyObject(spacing)) model.spacing = spacing;
  }

  if (layer.sizing && isNonEmptyObject(layer.sizing)) {
    const sizing: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(layer.sizing)) {
      const css = lengthToCss(val as { value: number; unit: string });
      if (css) sizing[key] = css;
    }
    if (isNonEmptyObject(sizing)) model.sizing = sizing;
  }

  if (layer.borders) {
    const borders: Record<string, unknown> = { ...(model.borders as object) };
    if (layer.borders.radius) borders.borderRadius = lengthToCss(layer.borders.radius);
    if (layer.borders.width) borders.borderWidth = lengthToCss(layer.borders.width);
    if (layer.borders.color) {
      const borderColor = safeColorForStyleModel(layer.borders.color);
      if (borderColor) borders.borderColor = borderColor;
      else recordInertColor(layer.borders.color, unresolved, "borders.color");
    }
    if (isNonEmptyObject(borders)) model.borders = borders;
  }

  if (layer.shadows?.boxShadow) {
    model.shadows = { boxShadow: layer.shadows.boxShadow };
  }

  if (layer.layout && isNonEmptyObject(layer.layout)) {
    const layout: Record<string, unknown> = { ...layer.layout };
    if (layout.textAlign && !model.typography) model.typography = {};
    if (layout.textAlign) (model.typography as Record<string, unknown>).textAlign = layout.textAlign;
    delete layout.textAlign;
    if (layout.gap != null) {
      model.spacing = { ...(model.spacing as object), gap: layout.gap };
      delete layout.gap;
    }
    if (typeof layout.columns === "number" && layout.gridTemplateColumns == null) {
      layout.gridTemplateColumns = `repeat(${layout.columns}, minmax(0, 1fr))`;
    }
    if (isNonEmptyObject(layout)) model.layout = layout;
  }

  if (layer.visibility) {
    const responsive = (model.responsive as Record<string, unknown>) ?? {};
    if (layer.visibility.hiddenDesktop) {
      responsive.desktop = { ...(responsive.desktop as object), hidden: true };
    }
    if (layer.visibility.hiddenTablet) {
      responsive.tablet = { ...(responsive.tablet as object), hidden: true };
    }
    if (layer.visibility.hiddenMobile) {
      responsive.mobile = { ...(responsive.mobile as object), hidden: true };
    }
    if (layer.visibility.zIndex != null) {
      model.position = { ...(model.position as object), zIndex: layer.visibility.zIndex };
    }
    if (isNonEmptyObject(responsive)) model.responsive = responsive;
  }

  if (layer.effects?.opacity != null) {
    model.effects = { ...(model.effects as object), opacity: layer.effects.opacity };
  }

  /* effects.rawCss is inert source material — never mapped to StyleModel (incl. customCss). */

  return model;
};

const collectInertSourceCssUnresolved = (
  layer: UniversalDesignLayer,
  unresolved: UniversalDesignUnresolved[],
): void => {
  const rawCss = layer.effects?.rawCss;
  if (typeof rawCss === "string" && rawCss.trim()) {
    unresolved.push({
      code: DESIGN_RAW_CSS_INERT,
      message: "Raw CSS preserved on UDD only; not applied to StyleModel or renderer.",
      detail: rawCss.trim(),
    });
  }
};

const mergeResponsiveBucketLayer = (baseLayer: StyleModel | undefined, overlayLayer: StyleModel): StyleModel => {
  const merged = mergeStyleModelSections(baseLayer ?? {}, overlayLayer) as StyleModel;
  const baseHidden = (baseLayer as Record<string, unknown> | undefined)?.hidden;
  const overlayHidden = (overlayLayer as Record<string, unknown>).hidden;
  if (overlayHidden === true || baseHidden === true) {
    (merged as Record<string, unknown>).hidden = true;
  } else if (overlayHidden === false) {
    delete (merged as Record<string, unknown>).hidden;
  }
  return merged;
};

/** Section-level StyleModel merge including responsive buckets (H1 + H2). */
export const mergeStyleModels = (base: StyleModel, overlay: StyleModel): StyleModel => {
  const merged = mergeStyleModelSections(base, overlay);
  const baseResponsive = base.responsive as Record<string, StyleModel> | undefined;
  const overlayResponsive = overlay.responsive as Record<string, StyleModel> | undefined;
  if (baseResponsive || overlayResponsive) {
    const combined: Record<string, StyleModel> = { ...(baseResponsive ?? {}) };
    for (const [breakpoint, overlayLayer] of Object.entries(overlayResponsive ?? {})) {
      combined[breakpoint] = mergeResponsiveBucketLayer(combined[breakpoint], overlayLayer);
    }
    merged.responsive = combined;
  }
  return merged;
};

/** Deterministic UDD → partial StyleModel (Phase I applies responsive layers later). */
export const resolveUniversalDesignToStyleModel = (
  data: UniversalDesignData,
): ResolvedUniversalDesign => {
  const unresolved: UniversalDesignUnresolved[] = [...(data.unresolved ?? [])];
  collectInertSourceCssUnresolved(data.desktop, unresolved);
  const styleModel = layerToStyleModel(data.desktop, unresolved);

  if (data.responsive) {
    const responsive: Record<string, StyleModel> = {
      ...((styleModel.responsive as Record<string, StyleModel>) ?? {}),
    };
    for (const [bucket, layer] of Object.entries(data.responsive)) {
      collectInertSourceCssUnresolved(layer, unresolved);
      const partial = layerToStyleModel(layer, unresolved);
      responsive[bucket] = mergeResponsiveBucketLayer(responsive[bucket], partial);
    }
    styleModel.responsive = responsive;
  }

  if (styleModel.customCss) {
    delete styleModel.customCss;
    unresolved.push({
      code: DESIGN_RAW_CSS_INERT,
      message: "StyleModel.customCss stripped — raw CSS must not flow from UDD resolver.",
    });
  }

  if (data.desktop.extensions?.themeClassNames?.length) {
    for (const className of data.desktop.extensions.themeClassNames) {
      unresolved.push({
        code: "DESIGN_THEME_CLASS",
        message: "Theme class name preserved in profile; not mapped to StyleModel in H1.",
        detail: className,
      });
    }
  }

  if (data.desktop.extensions?.motion != null) {
    unresolved.push({
      code: "DESIGN_MOTION_DEFERRED",
      message: "Motion/animation metadata captured in extensions; application deferred.",
    });
  }

  return { role: data.role, styleModel, unresolved };
};

export const mergeResolvedDesigns = (resolved: ResolvedUniversalDesign[]): StyleModel => {
  let merged: StyleModel = {};
  for (const item of resolved) {
    merged = mergeStyleModels(merged, item.styleModel);
  }
  return merged;
};
