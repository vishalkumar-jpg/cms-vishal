import { describe, expect, test } from "bun:test";
import type { StyleModel } from "../styles";
import { buildSiteDesignProfile } from "../universal-design/build-site-design-profile";
import {
  normalizeColorValue,
  colorToCssString,
  safeColorForStyleModel,
} from "../universal-design/normalize-color";
import { normalizeLengthValue } from "../universal-design/normalize-length";
import { normalizeTypographyFromFontObject } from "../universal-design/normalize-typography";
import {
  DESIGN_RAW_COLOR_CSS_INERT,
  DESIGN_RAW_CSS_INERT,
  mergeResolvedDesigns,
  mergeStyleModels,
  resolveUniversalDesignToStyleModel,
} from "../universal-design/resolve-to-style-model";
import { MAX_COLOR_OPACITY, UNIVERSAL_DESIGN_DATA_VERSION, type UniversalDesignData } from "../universal-design/types";

describe("universal-design normalization", () => {
  test("normalizeColorValue handles hex, rgb, named colors, and invalid input", () => {
    expect(normalizeColorValue("#FFFFFF")?.hex).toBe("#ffffff");
    expect(normalizeColorValue("rgb(1, 2, 3)")?.rgb).toBe("rgb(1, 2, 3)");
    expect(normalizeColorValue("rgba(1, 2, 3, 0.5)")?.rgb).toBe("rgba(1, 2, 3, 0.5)");
    expect(normalizeColorValue("red")?.hex).toBeUndefined();
    expect(normalizeColorValue("red")?.css).toBe("red");
    expect(normalizeColorValue("not-a-color!!!")?.css).toBe("not-a-color!!!");
    expect(normalizeColorValue({ color: "#FFFFFF", opacity: MAX_COLOR_OPACITY })?.hex).toBe("#ffffff");
    expect(colorToCssString({ hex: "#ffffff", opacity: 50 })).toBe("rgba(255, 255, 255, 0.5)");
    expect(colorToCssString({ hex: "#abcd", opacity: 50 })).toBe("rgba(170, 187, 204, 0.5)");
    expect(colorToCssString({ rgb: "rgb(1, 2, 3)", opacity: 50 })).toBe("rgba(1, 2, 3, 0.5)");
    expect(colorToCssString({ rgb: "rgb(1, 2, 3)" })).toBe("rgb(1, 2, 3)");
    expect(colorToCssString({ rgb: "rgb(invalid)", opacity: 50 })).toBeUndefined();
    expect(colorToCssString({ css: "red" })).toBeUndefined();
    expect(colorToCssString({ rgb: "rgb(invalid)" })).toBeUndefined();
    expect(safeColorForStyleModel({ rgb: "rgb(invalid)" })).toBeUndefined();
    expect(colorToCssString({ rgb: "rgb(1 2 3)" })).toBe("rgb(1, 2, 3)");
    expect(colorToCssString({ rgb: "rgb(1 2 3 / 50%)" })).toBe("rgba(1, 2, 3, 0.5)");
    expect(colorToCssString({ rgb: "rgb(1 2 3 / 0.5)" })).toBe("rgba(1, 2, 3, 0.5)");
    expect(colorToCssString({ rgb: "rgba(1, 2, 3, 0.5)" })).toBe("rgba(1, 2, 3, 0.5)");
    expect(safeColorForStyleModel({ rgb: "rgba(1, 2, 3, 0.5)" })).toBe("rgba(1, 2, 3, 0.5)");
  });

  test("resolveUniversalDesignToStyleModel preserves comma-separated rgba alpha", () => {
    const data: UniversalDesignData = {
      version: UNIVERSAL_DESIGN_DATA_VERSION,
      role: "part:title",
      desktop: {
        typography: {
          color: normalizeColorValue("rgba(1, 2, 3, 0.5)"),
        },
      },
    };
    const resolved = resolveUniversalDesignToStyleModel(data);
    expect(resolved.styleModel.colors?.textColor).toBe("rgba(1, 2, 3, 0.5)");
    expect(resolved.unresolved.some((u) => u.code === DESIGN_RAW_COLOR_CSS_INERT)).toBe(false);
  });

  test("resolveUniversalDesignToStyleModel accepts CSS Color 4 space-separated rgb", () => {
    const data: UniversalDesignData = {
      version: UNIVERSAL_DESIGN_DATA_VERSION,
      role: "part:title",
      desktop: {
        typography: {
          color: normalizeColorValue("rgb(10 20 30)"),
        },
      },
    };
    const resolved = resolveUniversalDesignToStyleModel(data);
    expect(resolved.styleModel.colors?.textColor).toBe("rgb(10, 20, 30)");
    expect(resolved.unresolved.some((u) => u.code === DESIGN_RAW_COLOR_CSS_INERT)).toBe(false);
  });

  test("normalizeLengthValue parses px strings and numbers", () => {
    expect(normalizeLengthValue(32)).toEqual({ value: 32, unit: "px" });
    expect(normalizeLengthValue("24px")).toEqual({ value: 24, unit: "px" });
  });

  test("normalizeTypographyFromFontObject preserves size_unit for numeric and string sizes", () => {
    expect(normalizeTypographyFromFontObject({ size: 2, size_unit: "rem" })?.fontSize).toEqual({
      value: 2,
      unit: "rem",
    });
    expect(normalizeTypographyFromFontObject({ size: "1.25", size_unit: "em" })?.fontSize).toEqual({
      value: 1.25,
      unit: "em",
    });
    expect(normalizeTypographyFromFontObject({ size: "50%", size_unit: "px" })?.fontSize).toEqual({
      value: 50,
      unit: "%",
    });
    const typography = normalizeTypographyFromFontObject({
      font: "Rethink Sans",
      size: 30,
      variant: "700",
      color: "#FFFFFF",
      styles: { bold: true },
    });
    expect(typography?.fontFamily).toBe("Rethink Sans");
    expect(typography?.fontSize).toEqual({ value: 30, unit: "px" });
    expect(typography?.fontWeight).toBe(700);
    expect(typography?.color?.hex).toBe("#ffffff");
  });

  test("resolveUniversalDesignToStyleModel is deterministic", () => {
    const data: UniversalDesignData = {
      version: UNIVERSAL_DESIGN_DATA_VERSION,
      role: "part:title",
      desktop: {
        typography: {
          fontFamily: "Rethink Sans",
          fontSize: { value: 30, unit: "px" },
          fontWeight: 700,
          color: { hex: "#ffffff" },
        },
      },
    };
    const a = resolveUniversalDesignToStyleModel(data);
    const b = resolveUniversalDesignToStyleModel(data);
    expect(a).toEqual(b);
    expect(a.styleModel.typography?.fontFamily).toBe("Rethink Sans");
    expect(a.styleModel.colors?.textColor).toBe("#ffffff");
  });

  test("resolveUniversalDesignToStyleModel rejects unsafe colors on StyleModel.colors", () => {
    const data: UniversalDesignData = {
      version: UNIVERSAL_DESIGN_DATA_VERSION,
      role: "settings:button.bg",
      desktop: {
        colors: {
          background: { css: "red" },
        },
      },
    };
    const resolved = resolveUniversalDesignToStyleModel(data);
    expect(resolved.styleModel.colors?.backgroundColor).toBeUndefined();
    expect(resolved.styleModel.colors?.background).toBeUndefined();
    expect(resolved.unresolved.some((u) => u.code === DESIGN_RAW_COLOR_CSS_INERT)).toBe(true);
  });

  test("resolveUniversalDesignToStyleModel records one inert typography color", () => {
    const resolved = resolveUniversalDesignToStyleModel({
      version: UNIVERSAL_DESIGN_DATA_VERSION,
      role: "part:title",
      desktop: { typography: { color: { css: "not-a-color" } } },
    });
    expect(resolved.unresolved.filter((u) => u.code === DESIGN_RAW_COLOR_CSS_INERT)).toHaveLength(1);
  });

  test("safeColorForStyleModel rejects raw CSS declaration snippets", () => {
    expect(safeColorForStyleModel({ css: "color: #FFFFFF;" })).toBeUndefined();
    expect(safeColorForStyleModel({ hex: "#ffffff" })).toBe("#ffffff");
  });

  test("resolveUniversalDesignToStyleModel keeps rawCss inert", () => {
    const data: UniversalDesignData = {
      version: UNIVERSAL_DESIGN_DATA_VERSION,
      role: "surface.structural",
      desktop: { effects: { rawCss: "background: url(javascript:alert(1));" } },
    };
    const resolved = resolveUniversalDesignToStyleModel(data);
    expect(resolved.styleModel.customCss).toBeUndefined();
    expect(resolved.unresolved.some((u) => u.code === DESIGN_RAW_CSS_INERT)).toBe(true);
  });

  test("mergeStyleModels preserves base values when overlay section properties are undefined", () => {
    const base: StyleModel = {
      typography: { fontSize: "32px", fontWeight: 700 },
      spacing: { paddingTop: "8px" },
    };
    const overlay: StyleModel = {
      typography: { fontSize: undefined },
    };
    const merged = mergeStyleModels(base, overlay);
    expect(merged.typography?.fontSize).toBe("32px");
    expect(merged.typography?.fontWeight).toBe(700);
    expect(merged.spacing?.paddingTop).toBe("8px");
    expect(base).toEqual({
      typography: { fontSize: "32px", fontWeight: 700 },
      spacing: { paddingTop: "8px" },
    });
    expect(overlay).toEqual({ typography: { fontSize: undefined } });
  });

  test("mergeStyleModels applies defined overlay typography and keeps legitimate falsy values", () => {
    const merged = mergeStyleModels(
      { typography: { fontSize: "16px", fontFamily: "A" }, effects: { opacity: 1 } },
      {
        typography: { fontSize: undefined, fontWeight: 700, letterSpacing: "" },
        effects: { opacity: 0 },
      },
    );
    expect(merged.typography?.fontSize).toBe("16px");
    expect(merged.typography?.fontWeight).toBe(700);
    expect(merged.typography?.letterSpacing).toBe("");
    expect(merged.effects?.opacity).toBe(0);
  });

  test("mergeStyleModels overlay fontSize overrides base when defined", () => {
    const merged = mergeStyleModels(
      { typography: { fontSize: "16px" } },
      { typography: { fontSize: "20px" } },
    );
    expect(merged.typography?.fontSize).toBe("20px");
  });

  test("mergeStyleModels skips undefined overlay sections and merges responsive buckets", () => {
    const base: StyleModel = {
      typography: { fontSize: "16px" },
      responsive: {
        tablet: { typography: { fontSize: "14px", fontWeight: 700 } },
      },
    };
    const overlay: StyleModel = {
      typography: undefined,
      responsive: {
        tablet: { typography: { fontSize: undefined, fontWeight: 600 } },
        mobile: { typography: { fontSize: "12px" } },
      },
    };
    const merged = mergeStyleModels(base, overlay);
    expect(merged.typography?.fontSize).toBe("16px");
    const tablet = (merged.responsive as Record<string, StyleModel>)?.tablet;
    expect(tablet?.typography?.fontSize).toBe("14px");
    expect(tablet?.typography?.fontWeight).toBe(600);
    const mobile = (merged.responsive as Record<string, StyleModel>)?.mobile;
    expect(mobile?.typography?.fontSize).toBe("12px");
    expect(base.responsive?.tablet?.typography?.fontSize).toBe("14px");
    expect(overlay.responsive?.tablet?.typography?.fontSize).toBeUndefined();
  });

  test("mergeStyleModels merges responsive.desktop.hidden across overlays", () => {
    const merged = mergeStyleModels(
      { responsive: { desktop: { typography: { fontSize: "16px" } } } },
      { responsive: { desktop: { hidden: true } } },
    );
    expect(merged.responsive?.desktop?.hidden).toBe(true);
    expect(merged.responsive?.desktop?.typography?.fontSize).toBe("16px");
  });

  test("mergeResolvedDesigns merges responsive breakpoints by section", () => {
    const typographyDesign = resolveUniversalDesignToStyleModel({
      version: UNIVERSAL_DESIGN_DATA_VERSION,
      role: "part:title",
      desktop: {},
      responsive: {
        tablet: { typography: { fontSize: { value: 18, unit: "px" } } },
        mobile: { typography: { fontSize: { value: 14, unit: "px" } } },
      },
    });
    const spacingDesign = resolveUniversalDesignToStyleModel({
      version: UNIVERSAL_DESIGN_DATA_VERSION,
      role: "part:grid",
      desktop: {},
      responsive: {
        tablet: { spacing: { paddingTop: { value: 8, unit: "px" } } },
        mobile: { spacing: { paddingTop: { value: 4, unit: "px" } } },
      },
    });
    const merged = mergeResolvedDesigns([typographyDesign, spacingDesign]);
    const tablet = (merged.responsive as Record<string, StyleModel>)?.tablet;
    expect(tablet?.typography?.fontSize).toBe("18px");
    expect(tablet?.spacing?.paddingTop).toBe("8px");
    const mobile = (merged.responsive as Record<string, StyleModel>)?.mobile;
    expect(mobile?.typography?.fontSize).toBe("14px");
    expect(mobile?.spacing?.paddingTop).toBe("4px");
  });

  test("buildSiteDesignProfile has no semantic primary/secondary labels", () => {
    const profile = buildSiteDesignProfile([
      {
        version: UNIVERSAL_DESIGN_DATA_VERSION,
        role: "part:a",
        desktop: { typography: { color: { hex: "#111111" } } },
      },
      {
        version: UNIVERSAL_DESIGN_DATA_VERSION,
        role: "part:b",
        desktop: { typography: { color: { hex: "#111111" } } },
      },
    ]);
    expect(Object.keys(profile)).toEqual(["version", "colors", "fontFamilies", "themeClassNames"]);
    expect(JSON.stringify(profile)).not.toContain("primary");
    expect(JSON.stringify(profile)).not.toContain("secondary");
  });

  test("buildSiteDesignProfile aggregates unique literals", () => {
    const profile = buildSiteDesignProfile([
      {
        version: UNIVERSAL_DESIGN_DATA_VERSION,
        role: "part:a",
        desktop: { typography: { color: { hex: "#111111" }, fontFamily: "A" } },
      },
      {
        version: UNIVERSAL_DESIGN_DATA_VERSION,
        role: "part:b",
        desktop: { typography: { color: { hex: "#111111" }, fontFamily: "B" } },
      },
    ]);
    expect(profile.colors).toEqual(["#111111"]);
    expect(profile.fontFamilies).toEqual(["A", "B"]);
  });
});
