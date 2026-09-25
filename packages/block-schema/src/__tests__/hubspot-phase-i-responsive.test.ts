import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COUNTER_SECTION_BLOCK,
  FEATURE_LIST_BLOCK,
} from "../resolved-block-names";
import {
  buildHubspotPageDesignContract,
  convertHubspotUpmToLayout,
  extractHubspotUniversalPage,
} from "../hubspot-upm";
import {
  isHiddenAtBreakpoint,
  isHiddenAtBreakpointForPreview,
  responsiveCssVars,
  resolveStyles,
  type StyleBreakpoint,
} from "../styles";
import { resolveUniversalDesignToStyleModel } from "../universal-design/resolve-to-style-model";
import { UNIVERSAL_DESIGN_DATA_VERSION } from "../universal-design/types";

const FIXTURES_DIR = join(import.meta.dir, "fixtures/hubspot");
const EXTRACTED_AT = "2026-01-01T00:00:00.000Z";

const extractFixture = (name: string, hsId: string) =>
  extractHubspotUniversalPage({
    raw: JSON.parse(readFileSync(join(FIXTURES_DIR, name), "utf8")) as Record<string, unknown>,
    kind: "page",
    hsId,
    extractedAtIso: EXTRACTED_AT,
  });

const findBlock = (layout: ReturnType<typeof convertHubspotUpmToLayout>["layout"], name: string) => {
  const node = Object.values(layout.nodes).find((n) => n.type.resolvedName === name);
  if (!node) throw new Error(`${name} block not found`);
  return node;
};

describe("Phase I — desktop visibility (StyleModel)", () => {
  test("hiddenDesktop maps to responsive.desktop.hidden", () => {
    const resolved = resolveUniversalDesignToStyleModel({
      version: UNIVERSAL_DESIGN_DATA_VERSION,
      role: "part:visibility",
      desktop: {
        visibility: { hiddenDesktop: true, hiddenTablet: false, hiddenMobile: false },
      },
    });
    expect(resolved.styleModel.responsive?.desktop?.hidden).toBe(true);
    expect(resolved.styleModel.responsive?.tablet?.hidden).toBeUndefined();
  });

  test("responsiveCssVars emits desktop-band hide var without tablet/mobile hide vars", () => {
    const vars = responsiveCssVars({
      responsive: { desktop: { hidden: true } },
    });
    expect(vars["--ob-r-desktop-band-display"]).toBe("none");
    expect(vars["--ob-r-tablet-display"]).toBeUndefined();
    expect(vars["--ob-r-mobile-display"]).toBeUndefined();
  });

  test("desktop hidden + tablet/mobile visible — preview hide only on desktop band", () => {
    const styles = {
      responsive: {
        desktop: { hidden: true },
        tablet: { hidden: false },
        mobile: { hidden: false },
      },
    };
    expect(isHiddenAtBreakpointForPreview(styles, "desktop")).toBe(true);
    expect(isHiddenAtBreakpointForPreview(styles, "laptop")).toBe(true);
    expect(isHiddenAtBreakpointForPreview(styles, "tablet")).toBe(false);
    expect(isHiddenAtBreakpointForPreview(styles, "mobile")).toBe(false);
  });

  test("desktop-band preview breakpoints honor their active hidden flag", () => {
    const styles = {
      responsive: {
        desktop: { hidden: false },
        laptop: { hidden: true },
        largeDesktop: { hidden: true },
      },
    };
    expect(isHiddenAtBreakpointForPreview(styles, "desktop")).toBe(false);
    expect(isHiddenAtBreakpointForPreview(styles, "laptop")).toBe(true);
    expect(isHiddenAtBreakpointForPreview(styles, "largeDesktop")).toBe(true);
  });
});

describe("Phase I — synthetic visibility fixtures (HubSpot → StyleModel)", () => {
  const visibilityCases = [
    {
      fixture: "synthetic-visibility-desktop-native.json",
      hsId: "syn-vis-desktop",
      expectHidden: { desktop: true, tablet: false, mobile: false },
    },
    {
      fixture: "synthetic-visibility-tablet-native.json",
      hsId: "syn-vis-tablet",
      expectHidden: { desktop: false, tablet: true, mobile: false },
    },
    {
      fixture: "synthetic-visibility-mobile-native.json",
      hsId: "syn-vis-mobile",
      expectHidden: { desktop: false, tablet: false, mobile: true },
    },
    {
      fixture: "synthetic-visibility-mixed-native.json",
      hsId: "syn-vis-mixed",
      expectHidden: { desktop: true, tablet: false, mobile: true },
    },
  ] as const;

  for (const { fixture, hsId, expectHidden } of visibilityCases) {
    test(`${fixture} applies visibility on Counter Section root styles`, () => {
      const upm = extractFixture(fixture, hsId);
      const contract = buildHubspotPageDesignContract(upm);
      const { layout } = convertHubspotUpmToLayout(upm, { designContract: contract });
      const counter = findBlock(layout, COUNTER_SECTION_BLOCK);
      const styles = (counter.props as Record<string, unknown>).styles as Record<string, unknown>;
      const responsive = styles.responsive as Record<string, { hidden?: boolean }>;
      if (expectHidden.desktop) {
        expect(responsive?.desktop?.hidden).toBe(true);
      } else {
        expect(responsive?.desktop?.hidden).not.toBe(true);
      }
      if (expectHidden.tablet) {
        expect(responsive?.tablet?.hidden).toBe(true);
      } else {
        expect(isHiddenAtBreakpoint(styles, "tablet")).toBe(false);
      }
      if (expectHidden.mobile) {
        expect(responsive?.mobile?.hidden).toBe(true);
      } else {
        expect(isHiddenAtBreakpoint(styles, "mobile")).toBe(false);
      }
    });
  }
});

describe("Phase I — responsive grid columns (layout.columns → gridTemplateColumns)", () => {
  test("layerToStyleModel derives gridTemplateColumns from layout.columns", () => {
    const resolved = resolveUniversalDesignToStyleModel({
      version: UNIVERSAL_DESIGN_DATA_VERSION,
      role: "part:grid",
      desktop: { layout: { columns: 4 } },
    });
    expect(resolved.styleModel.layout?.gridTemplateColumns).toBe("repeat(4, minmax(0, 1fr))");
  });

  test("counters-native partStyles.grid includes gridTemplateColumns at desktop", () => {
    const upm = extractFixture("layout-sections-module-counters-native.json", "grid-corpus");
    const contract = buildHubspotPageDesignContract(upm);
    const { layout } = convertHubspotUpmToLayout(upm, { designContract: contract });
    const counter = findBlock(layout, COUNTER_SECTION_BLOCK);
    const partGrid = ((counter.props as Record<string, unknown>).partStyles as Record<string, unknown>)
      ?.grid as Record<string, unknown>;
    const css = resolveStyles(partGrid ?? {}, "desktop", { fluid: false });
    expect(String(css.gridTemplateColumns)).toContain("repeat(3");
  });
});

describe("Phase I — spacing_mobile (synthetic)", () => {
  test("synthetic-spacing-mobile-native.json maps title spacing_mobile to responsive mobile layer", () => {
    const upm = extractFixture("synthetic-spacing-mobile-native.json", "syn-spacing-mobile");
    const contract = buildHubspotPageDesignContract(upm);
    const titleEntry = contract.nodes
      .flatMap((n) => n.resolved)
      .find((r) => r.role === "part:title");
    expect(titleEntry).toBeDefined();
    const mobile = titleEntry!.styleModel.responsive?.mobile?.spacing?.paddingTop;
    expect(mobile).toBe("24px");
  });
});

describe("Phase I — corpus responsive regression matrix (fixture × breakpoint × block)", () => {
  const corpusCases = [
    {
      fixture: "layout-sections-module-counters-native.json",
      hsId: "corpus-counters",
      block: COUNTER_SECTION_BLOCK,
      breakpoint: "tablet" as StyleBreakpoint,
      assert: (props: Record<string, unknown>) => {
        const partGrid = (props.partStyles as Record<string, unknown>)?.grid as Record<string, unknown>;
        const css = resolveStyles(partGrid ?? {}, "tablet", { fluid: false });
        expect(css.gridTemplateColumns ?? css.columns).toBeDefined();
      },
    },
  ] as const;

  for (const row of corpusCases) {
    test(`${row.fixture} → ${row.block} @ ${row.breakpoint}`, () => {
      const upm = extractFixture(row.fixture, row.hsId);
      const contract = buildHubspotPageDesignContract(upm);
      const { layout } = convertHubspotUpmToLayout(upm, { designContract: contract });
      row.assert(findBlock(layout, row.block).props as Record<string, unknown>);
    });
  }

  test("layout-sections-module-gallery-f2-native.json contract resolves responsive part:grid", () => {
    const upm = extractFixture("layout-sections-module-gallery-f2-native.json", "corpus-gallery");
    const contract = buildHubspotPageDesignContract(upm);
    const grid = contract.nodes.flatMap((n) => n.resolved).find((r) => r.role === "part:grid");
    expect(grid?.styleModel.responsive?.mobile ?? grid?.styleModel.responsive?.tablet).toBeDefined();
    const css = resolveStyles(grid?.styleModel ?? {}, "mobile", { fluid: false });
    expect(css.gridTemplateColumns ?? css.columns).toBeDefined();
  });

  test("layout-sections-module-logos-f2-native.json contract resolves responsive part:grid", () => {
    const upm = extractFixture("layout-sections-module-logos-f2-native.json", "corpus-logos");
    const contract = buildHubspotPageDesignContract(upm);
    const grid = contract.nodes.flatMap((n) => n.resolved).find((r) => r.role === "part:grid");
    expect(grid?.styleModel.responsive?.largeDesktop ?? grid?.styleModel.responsive?.tablet).toBeDefined();
  });

  test("layout-sections-module-tabs-native.json contract retains module design entries", () => {
    const upm = extractFixture("layout-sections-module-tabs-native.json", "corpus-tabs");
    const contract = buildHubspotPageDesignContract(upm);
    expect(contract.nodes.some((n) => n.resolved.length > 0)).toBe(true);
  });

  test("layout-sections-module-cards-native.json converts Feature List content block", () => {
    const upm = extractFixture("layout-sections-module-cards-native.json", "corpus-features");
    const contract = buildHubspotPageDesignContract(upm);
    const { layout } = convertHubspotUpmToLayout(upm, { designContract: contract });
    const feature = findBlock(layout, FEATURE_LIST_BLOCK);
    expect(Array.isArray((feature.props as Record<string, unknown>).features)).toBe(true);
  });

  test("OB laptop cascade only — no HubSpot laptop bucket in contract", () => {
    const upm = extractFixture("layout-sections-module-counters-native.json", "laptop-check");
    const contract = buildHubspotPageDesignContract(upm);
    for (const bundle of contract.nodes) {
      for (const entry of bundle.entries) {
        expect(entry.data.responsive?.laptop).toBeUndefined();
      }
    }
  });
});
