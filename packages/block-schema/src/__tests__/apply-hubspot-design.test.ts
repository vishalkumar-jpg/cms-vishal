import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { blockPropSchemas } from "../block-props";
import { migrate } from "../migrate";
import { repairLayout } from "../repair";
import { COUNTER_SECTION_BLOCK } from "../resolved-block-names";
import {
  applyHubspotDesignToBlock,
  buildHubspotPageDesignContract,
  convertHubspotUpmToLayout,
  DESIGN_APPLY_ROLE_UNMAPPED,
  extractHubspotUniversalPage,
  indexHubspotDesignBundlesBySourcePath,
} from "../hubspot-upm";
import type { HubspotNodeDesignBundle } from "../hubspot-upm/hubspot-design-contract";
import { HUBSPOT_LAYOUT_CUSTOM_KEY } from "../hubspot-upm/hubspot-node-custom";
import { resolveStyles } from "../styles";
import { DESIGN_ROLE_MODULE_ROOT } from "../universal-design/semantic-tokens";
import {
  DESIGN_RAW_CSS_INERT,
  resolveUniversalDesignToStyleModel,
} from "../universal-design/resolve-to-style-model";
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

const findCounterBlock = (layout: ReturnType<typeof convertHubspotUpmToLayout>["layout"]) => {
  const node = Object.values(layout.nodes).find((n) => n.type.resolvedName === COUNTER_SECTION_BLOCK);
  if (!node) throw new Error("Counter Section block not found");
  return node;
};

const counterBaseBlock = (sourcePath: string) => ({
  type: { resolvedName: COUNTER_SECTION_BLOCK },
  isCanvas: false,
  props: { stats: [{ value: "1", label: "A" }], styles: { spacing: { paddingTop: "4px" } } },
  displayName: COUNTER_SECTION_BLOCK,
  custom: { [HUBSPOT_LAYOUT_CUSTOM_KEY]: { sourcePath, conversionRole: "x" } },
  parent: "p",
  hidden: false,
  nodes: [],
  linkedNodes: {},
});

describe("applyHubspotDesign (Phase H2)", () => {
  test("applyHubspotDesignToBlock merges root and part styles for Counter Section", () => {
    const upm = extractFixture("layout-sections-module-counters-native.json", "h2-apply");
    const contract = buildHubspotPageDesignContract(upm);
    const bundle = indexHubspotDesignBundlesBySourcePath(contract).get(
      contract.nodes.find((n) => n.nodeKind === "module")!.sourcePath,
    );
    expect(bundle).toBeDefined();

    const applied = applyHubspotDesignToBlock({
      block: counterBaseBlock(bundle!.sourcePath),
      resolvedName: COUNTER_SECTION_BLOCK,
      sourcePath: bundle!.sourcePath,
      bundle,
    });

    expect(applied.appliedEntryKeys.length).toBeGreaterThan(0);
    const props = applied.block.props as Record<string, unknown>;
    const styles = props.styles as Record<string, unknown>;
    expect(styles.spacing).toBeDefined();
    expect((props.partStyles as Record<string, unknown>).value).toBeDefined();
    expect(
      (applied.block.custom[HUBSPOT_LAYOUT_CUSTOM_KEY] as { appliedDesignEntryKeys?: string[] })
        .appliedDesignEntryKeys?.length,
    ).toBeGreaterThan(0);
  });

  test("convertHubspotUpmToLayout applies design to counters-native Counter Section", () => {
    const upm = extractFixture("layout-sections-module-counters-native.json", "h2-layout");
    const { layout, deferredModules } = convertHubspotUpmToLayout(upm);
    expect(deferredModules.length).toBe(0);
    const counter = findCounterBlock(layout);
    const props = counter.props as Record<string, unknown>;
    expect(props.styles).toBeDefined();
    const partStyles = props.partStyles as Record<string, Record<string, unknown>>;
    expect(partStyles.value?.typography ?? partStyles.value?.colors).toBeDefined();
    expect(partStyles.label).toBeDefined();

    const valueCss = resolveStyles(partStyles.value);
    expect(valueCss.fontSize ?? valueCss.color).toBeDefined();

    const repaired = repairLayout(layout);
    const migrated = migrate(repaired);
    const schema = blockPropSchemas[COUNTER_SECTION_BLOCK];
    expect(schema.safeParse(counter.props).success).toBe(true);
    const migratedCounter = findCounterBlock(migrated);
    expect(schema.safeParse(migratedCounter.props).success).toBe(true);
  });

  test("convertHubspotUpmToLayout preserves provenance and is deterministic", () => {
    const upm = extractFixture("layout-sections-module-counters-native.json", "h2-det");
    const a = convertHubspotUpmToLayout(upm);
    const b = convertHubspotUpmToLayout(upm);
    const counterA = findCounterBlock(a.layout);
    const counterB = findCounterBlock(b.layout);
    expect(counterA.props).toEqual(counterB.props);
    expect(counterA.custom[HUBSPOT_LAYOUT_CUSTOM_KEY]).toEqual(counterB.custom[HUBSPOT_LAYOUT_CUSTOM_KEY]);
  });

  test("applyHubspotDesignToBlock applies mapped roles and emits DESIGN_APPLY_ROLE_UNMAPPED for others", () => {
    const sourcePath = "/modules/counter-test";
    const bundle: HubspotNodeDesignBundle = {
      sourcePath,
      nodeId: "counter-node",
      nodeKind: "module",
      entries: [],
      losslessSlices: [],
      resolved: [
        {
          entryKey: "loc::surface.module",
          hubspotLocator: "loc",
          role: DESIGN_ROLE_MODULE_ROOT,
          styleModel: { spacing: { paddingTop: "12px" } },
          unresolved: [],
        },
        {
          entryKey: "loc::part:prefix",
          hubspotLocator: "loc",
          role: "part:prefix",
          styleModel: { typography: { fontSize: "10px" } },
          unresolved: [],
        },
      ],
    };

    const applied = applyHubspotDesignToBlock({
      block: counterBaseBlock(sourcePath),
      resolvedName: COUNTER_SECTION_BLOCK,
      sourcePath,
      bundle,
    });

    const props = applied.block.props as Record<string, unknown>;
    expect((props.styles as Record<string, unknown>).spacing).toEqual(
      expect.objectContaining({ paddingTop: "12px" }),
    );
    expect((props.partStyles as Record<string, unknown> | undefined)?.prefix).toBeUndefined();
    expect(applied.diagnostics.some((d) => d.code === DESIGN_APPLY_ROLE_UNMAPPED)).toBe(true);
    expect(applied.appliedEntryKeys).toEqual(["loc::surface.module"]);
  });

  test("empty styleModel and inert rawCss-only entries are not recorded as applied", () => {
    const sourcePath = "/modules/counter-empty";
    const inertStructural = resolveUniversalDesignToStyleModel({
      version: UNIVERSAL_DESIGN_DATA_VERSION,
      role: DESIGN_ROLE_MODULE_ROOT,
      desktop: { effects: { rawCss: "color: red;" } },
    });
    expect(inertStructural.unresolved.some((u) => u.code === DESIGN_RAW_CSS_INERT)).toBe(true);
    expect(Object.keys(inertStructural.styleModel).length).toBe(0);

    const bundle: HubspotNodeDesignBundle = {
      sourcePath,
      nodeId: "counter-node",
      nodeKind: "module",
      entries: [],
      losslessSlices: [],
      resolved: [
        {
          entryKey: "loc::surface.module",
          hubspotLocator: "loc",
          role: DESIGN_ROLE_MODULE_ROOT,
          styleModel: {},
          unresolved: [],
        },
        {
          entryKey: "loc::surface.structural",
          hubspotLocator: "loc",
          role: "surface.structural",
          styleModel: inertStructural.styleModel,
          unresolved: inertStructural.unresolved,
        },
        {
          entryKey: "loc::part:number",
          hubspotLocator: "loc",
          role: "part:number",
          styleModel: { typography: { fontSize: "22px" } },
          unresolved: [],
        },
      ],
    };

    const applied = applyHubspotDesignToBlock({
      block: counterBaseBlock(sourcePath),
      resolvedName: COUNTER_SECTION_BLOCK,
      sourcePath,
      bundle,
    });

    expect(applied.appliedEntryKeys).toEqual(["loc::part:number"]);
    const hubspotCustom = applied.block.custom[HUBSPOT_LAYOUT_CUSTOM_KEY] as {
      appliedDesignEntryKeys?: string[];
    };
    expect(hubspotCustom.appliedDesignEntryKeys).toEqual(["loc::part:number"]);
  });

  test("counters-native applies responsive grid styles on module root or grid part", () => {
    const upm = extractFixture("layout-sections-module-counters-native.json", "h2-responsive");
    const { layout } = convertHubspotUpmToLayout(upm);
    const counter = findCounterBlock(layout);
    const styles = (counter.props as Record<string, unknown>).styles as Record<string, unknown>;
    const responsive = styles.responsive as Record<string, unknown> | undefined;
    const partGrid = ((counter.props as Record<string, unknown>).partStyles as Record<string, unknown>)
      ?.grid as Record<string, unknown> | undefined;
    expect(responsive?.tablet ?? responsive?.mobile ?? partGrid?.layout ?? partGrid?.spacing).toBeDefined();
  });
});
