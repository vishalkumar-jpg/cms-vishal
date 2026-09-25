import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildHubspotPageDesignContract,
  extractHubspotDesignFromSourceNode,
  extractHubspotUniversalPage,
} from "../hubspot-upm";
import {
  DESIGN_PART_ROLE_PREFIX,
  DESIGN_ROLE_MODULE_ROOT,
  DESIGN_SETTINGS_ROLE_PREFIX,
} from "../universal-design/semantic-tokens";
import { UNIVERSAL_DESIGN_DATA_VERSION } from "../universal-design/types";

const FIXTURES_DIR = join(import.meta.dir, "fixtures/hubspot");
const EXTRACTED_AT = "2026-01-01T00:00:00.000Z";

/** Corpus fixtures where every module node carries applicable HubSpot design/style data. */
const STYLE_BEARING_CORPUS_FIXTURES = [
  "layout-sections-module-articles-f2-native.json",
  "layout-sections-module-button-f2-native.json",
  "layout-sections-module-counters-native.json",
  "layout-sections-module-gallery-f2-native.json",
  "layout-sections-module-image-f2-native.json",
  "layout-sections-module-logos-f2-native.json",
  "layout-sections-module-stats-native.json",
  "layout-sections-module-steps-native.json",
  "layout-sections-module-tabs-native.json",
  "layout-sections-module.json",
] as const;

const loadFixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(FIXTURES_DIR, name), "utf8")) as Record<string, unknown>;

const extractFixture = (file: string, hsId: string) =>
  extractHubspotUniversalPage({
    raw: loadFixture(file),
    kind: "page",
    hsId,
    extractedAtIso: EXTRACTED_AT,
  });

const findFirstModule = (upm: ReturnType<typeof extractFixture>) => {
  const visit = (nodes: { nodeKind: string; children: unknown[] }[]): unknown => {
    for (const node of nodes as Array<{ nodeKind: string; children: unknown[] } & object>) {
      if (node.nodeKind === "module") return node;
      const nested = visit(node.children as { nodeKind: string; children: unknown[] }[]);
      if (nested) return nested;
    }
    return undefined;
  };
  for (const region of upm.regions) {
    const found = visit(region.nodes as { nodeKind: string; children: unknown[] }[]);
    if (found) return found as Parameters<typeof extractHubspotDesignFromSourceNode>[0];
  }
  throw new Error("no module in fixture");
};

describe("HubSpot design extraction (Phase H1)", () => {
  test("counters fixture extracts part typography and responsive grid", () => {
    const upm = extractFixture("layout-sections-module-counters-native.json", "f1-counters");
    const moduleNode = findFirstModule(upm);
    const { entries, losslessSlices } = extractHubspotDesignFromSourceNode(moduleNode);

    expect(losslessSlices.some((s) => s.locator.includes("styles"))).toBe(true);
    const numberPart = entries.find((e) => e.role === `${DESIGN_PART_ROLE_PREFIX}number`);
    expect(numberPart?.data.desktop.typography?.color?.hex).toBe("#ffffff");

    const titlePart = entries.find((e) => e.role === `${DESIGN_PART_ROLE_PREFIX}title`);
    expect(titlePart?.data.desktop.typography?.fontFamily).toBe("Rethink Sans");
    expect(titlePart?.data.desktop.typography?.fontSize).toEqual({ value: 30, unit: "px" });

    const gridPart = entries.find((e) => e.role === `${DESIGN_PART_ROLE_PREFIX}grid`);
    expect(gridPart?.data.desktop.spacing?.gap).toEqual({ value: 32, unit: "px" });
    expect(gridPart?.data.responsive?.tablet?.spacing?.gap).toEqual({ value: 32, unit: "px" });
    expect(gridPart?.data.responsive?.mobile?.spacing?.gap).toEqual({ value: 32, unit: "px" });
  });

  test("steps fixture extracts style_settings typography and button colors", () => {
    const upm = extractFixture("layout-sections-module-steps-native.json", "f1-steps");
    const moduleNode = findFirstModule(upm);
    const { entries, losslessSlices } = extractHubspotDesignFromSourceNode(moduleNode);

    expect(losslessSlices.some((s) => s.locator.includes("style_settings"))).toBe(true);
    expect(entries.some((e) => e.role.startsWith(`${DESIGN_SETTINGS_ROLE_PREFIX}typography.`))).toBe(
      true,
    );
    expect(entries.some((e) => e.role.startsWith(`${DESIGN_SETTINGS_ROLE_PREFIX}button.`))).toBe(true);
    expect(entries.some((e) => e.role.startsWith(`${DESIGN_SETTINGS_ROLE_PREFIX}steps_card.`))).toBe(
      true,
    );
  });

  test("button fixture preserves theme class names without silent drop", () => {
    const upm = extractFixture("layout-sections-module-button-f2-native.json", "f2-button");
    const moduleNode = findFirstModule(upm);
    const { entries } = extractHubspotDesignFromSourceNode(moduleNode);
    const withClasses = entries.flatMap((e) => e.data.desktop.extensions?.themeClassNames ?? []);
    expect(withClasses.some((c) => c.includes("button--"))).toBe(true);
  });

  test("cards fixture maps flat params.styles.gap", () => {
    const upm = extractFixture("layout-sections-module.json", "3003");
    const moduleNode = findFirstModule(upm);
    const { entries } = extractHubspotDesignFromSourceNode(moduleNode);
    const root = entries.find((e) => e.role === DESIGN_ROLE_MODULE_ROOT);
    expect(root?.data.desktop.spacing?.gap).toEqual({ value: 24, unit: "px" });
  });

  test("nested params use params locator without duplicating payload style walk", () => {
    const upm = extractFixture("layout-sections-module.json", "nested-locator");
    const moduleNode = findFirstModule(upm);
    const payload = moduleNode.payload as Record<string, unknown>;
    const { entries, losslessSlices } = extractHubspotDesignFromSourceNode({
      ...moduleNode,
      payload: {
        ...payload,
        css: "outer css",
        child_css: "outer child css",
        cssStyle: "color: red",
        styles: { gap: "99px" },
      },
    });
    expect(losslessSlices.some((l) => l.locator.startsWith("params."))).toBe(true);
    expect(losslessSlices.some((l) => l.locator === "params.styles")).toBe(true);
    expect(losslessSlices.some((l) => l.locator === "payload.css")).toBe(true);
    expect(losslessSlices.some((l) => l.locator === "payload.child_css")).toBe(true);
    expect(losslessSlices.some((l) => l.locator === "payload.cssStyle")).toBe(true);
    expect(losslessSlices.some((l) => l.locator === "payload.styles")).toBe(false);
    expect(entries.some((e) => e.data.desktop.effects?.rawCss === "color: red")).toBe(true);
  });

  test("flattened module payload uses payload locator only", () => {
    const upm = extractFixture("layout-sections-module-counters-native.json", "flat-locator");
    const moduleNode = findFirstModule(upm);
    const { losslessSlices } = extractHubspotDesignFromSourceNode(moduleNode);
    expect(losslessSlices.some((l) => l.locator.startsWith("params."))).toBe(false);
    expect(losslessSlices.some((l) => l.locator.startsWith("payload."))).toBe(true);
  });

  test("buildHubspotPageDesignContract enables H2 without raw payload reparse", () => {
    const upm = extractFixture("layout-sections-module-counters-native.json", "f1-counters");
    const contract = buildHubspotPageDesignContract(upm);
    expect(contract.nodes.length).toBeGreaterThan(0);
    const moduleBundle = contract.nodes.find((n) => n.nodeKind === "module");
    expect(moduleBundle?.losslessSlices.length).toBeGreaterThan(0);
    expect(moduleBundle?.resolved.length).toBe(moduleBundle?.entries.length);
    expect(contract.pageDesign.nodes.length).toBeGreaterThan(0);
    expect(contract.pageDesign.profile.colors.length).toBeGreaterThan(0);
    const first = contract.pageDesign.nodes[0]!;
    expect(first.designs.every((d) => d.entryKey.includes("::"))).toBe(true);
    expect(first.resolved.every((r) => first.designs.some((d) => d.entryKey === r.entryKey))).toBe(true);
  });

  test("buildHubspotPageDesignContract aggregates resolver diagnostics at page level", () => {
    const upm = extractFixture("layout-sections-module-steps-native.json", "page-diagnostics");
    const contract = buildHubspotPageDesignContract(upm);
    expect(contract.diagnostics.length).toBeGreaterThan(0);
    expect(contract.pageDesign.diagnostics).toEqual(contract.diagnostics);
    const unmapped = contract.diagnostics.find((d) => d.code === "DESIGN_UNMAPPED_FIELD");
    expect(unmapped?.sourcePath).toBeTruthy();
    expect(unmapped?.locator).toContain("style_settings");
  });

  test("design entry keys are unique per node and globally by sourcePath", () => {
    const contract = buildHubspotPageDesignContract(
      extractFixture("layout-sections-module-tabs-native.json", "tabs-keys"),
    );
    for (const node of contract.nodes) {
      const keys = node.entries.map((e) => e.entryKey);
      expect(new Set(keys).size).toBe(keys.length);
    }
    const globalKeys = contract.nodes.flatMap((n) =>
      n.entries.map((e) => `${n.sourcePath}::${e.entryKey}`),
    );
    expect(new Set(globalKeys).size).toBe(globalKeys.length);
  });

  test("lossless slices cover styles, style_settings, animation, and custom_font", () => {
    const counters = buildHubspotPageDesignContract(
      extractFixture("layout-sections-module-counters-native.json", "c-loss"),
    ).nodes.find((n) => n.nodeKind === "module")!;
    expect(counters.losslessSlices.some((l) => l.locator.endsWith(".styles"))).toBe(true);
    expect(counters.losslessSlices.some((l) => l.locator.includes("custom_font"))).toBe(true);

    const steps = buildHubspotPageDesignContract(
      extractFixture("layout-sections-module-steps-native.json", "s-loss"),
    ).nodes.find((n) => n.nodeKind === "module")!;
    expect(steps.losslessSlices.some((l) => l.locator.endsWith(".style_settings"))).toBe(true);

    const button = buildHubspotPageDesignContract(
      extractFixture("layout-sections-module-button-f2-native.json", "b-loss"),
    ).nodes.find((n) => n.nodeKind === "module")!;
    expect(button.losslessSlices.some((l) => l.locator.includes(".animation"))).toBe(true);
  });

  test("extraction does not mutate UPM module payload", () => {
    const upm = extractFixture("layout-sections-module-counters-native.json", "f1-counters");
    const before = JSON.stringify(upm);
    buildHubspotPageDesignContract(upm);
    expect(JSON.stringify(upm)).toBe(before);
  });

  test.each(STYLE_BEARING_CORPUS_FIXTURES)(
    "corpus fixture %s requires lossless slices on every style-bearing module",
    (file) => {
      const upm = extractFixture(file, `design-${file}`);
      const contract = buildHubspotPageDesignContract(upm);
      const moduleNodes = contract.nodes.filter((n) => n.nodeKind === "module");
      expect(moduleNodes.length).toBeGreaterThan(0);
      for (const node of moduleNodes) {
        expect(node.losslessSlices.length).toBeGreaterThan(0);
        expect(node.entries.length).toBeGreaterThan(0);
        expect(node.resolved.length).toBe(node.entries.length);
      }
      expect(contract.pageDesign.profile.version).toBe(UNIVERSAL_DESIGN_DATA_VERSION);
    },
  );
});
