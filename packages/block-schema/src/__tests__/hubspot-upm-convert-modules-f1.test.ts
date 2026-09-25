import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { blockPropSchemas } from "../block-props";
import { migrate, repairLayout } from "../index";
import {
  convertHubspotUpmToLayout,
  extractHubspotUniversalPage,
  MODULE_CONVERTED_NATIVE,
  NATIVE_COUNTER_SECTION,
  NATIVE_STEP_CARDS,
  NATIVE_TABS,
  tryConvertHubspotModuleNode,
  type HubspotSourceNode,
} from "../hubspot-upm";
import { stableNodeIdFromPath } from "../hubspot-upm/json-utils";
import {
  HUBSPOT_CARDS_PARAM_KEY,
  HUBSPOT_COUNTERS_PARAM_KEY,
  HUBSPOT_FEATURES_PARAM_KEY,
  HUBSPOT_STATS_PARAM_KEY,
  HUBSPOT_STEPS_PARAM_KEY,
  HUBSPOT_TABS_PARAM_KEY,
} from "../hubspot-upm/complex-module-param-keys";
import { HUBSPOT_PIKE_COUNTERS_PATH } from "../hubspot-upm/converters/pike-counters-to-counter-section";
import { HUBSPOT_PIKE_TABS_PATH } from "../hubspot-upm/converters/tabs-to-tabs";
import {
  COUNTER_SECTION_BLOCK,
  FEATURE_LIST_BLOCK,
  GROUP_BLOCK,
  STEP_CARDS_BLOCK,
  TABS_BLOCK,
} from "../resolved-block-names";

const FIXTURES_DIR = join(import.meta.dir, "fixtures/hubspot");
const EXTRACTED_AT = "2026-01-01T00:00:00.000Z";

const loadFixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(FIXTURES_DIR, name), "utf8")) as Record<string, unknown>;

const extractFixture = (name: string, hsId = "fixture-id") =>
  extractHubspotUniversalPage({
    raw: loadFixture(name),
    kind: "page",
    hsId,
    extractedAtIso: EXTRACTED_AT,
  });

const findFirstModule = (upm: ReturnType<typeof extractFixture>): HubspotSourceNode => {
  let found: HubspotSourceNode | undefined;
  const visit = (nodes: HubspotSourceNode[]): void => {
    for (const node of nodes) {
      if (node.nodeKind === "module") found = node;
      visit(node.children);
    }
  };
  for (const region of upm.regions) visit(region.nodes);
  if (!found) throw new Error("expected module in fixture");
  return found;
};

const baseModuleProvenance = (sourcePath: string): HubspotSourceNode["provenance"] => ({
  hubspotHsId: "x",
  hubspotKind: "page",
  sourcePath,
  extractionStatus: "ok",
  normalizationStatus: "classified",
});

const syntheticModule = (
  sourcePath: string,
  payload: Record<string, unknown>,
): HubspotSourceNode => ({
  id: "mod-synthetic",
  sourcePath,
  nodeKind: "module",
  hubspot: { moduleId: "synthetic_mod", moduleType: "custom_widget" },
  payload,
  htmlFragments: [],
  children: [],
  provenance: baseModuleProvenance(sourcePath),
});

const corpusPikeTab = {
  title: { text: "Logistics Support" },
  description: { text: "" },
  contents: [
    {
      content:
        "<h5>Logistics Support</h5>\n<ul>\n<li>Automate shipping notifications.</li>\n</ul>",
    },
  ],
};

const corpusPikeCounterItem = {
  stat: {
    formatted: true,
    number: 40,
    prefix: "",
    prefix_superscript: false,
    suffix: "%",
    suffix_superscript: true,
  },
  stats_description: {
    stat_description: "<div><span>Average savings narrative.</span></div>",
  },
  title: { value: "Average Cost Savings" },
};

const corpusStepItem = {
  step_title: "Apply",
  step_description: "<p>Request your invitation.</p>",
};

const corpusStatItem = {
  stat_description: "<p>Supporting businesses globally.</p>",
  stat_label: "Global Employees",
  stat_number: "5500+",
};

const expectSchemaValid = (layout: ReturnType<typeof convertHubspotUpmToLayout>["layout"]) => {
  const repaired = migrate(repairLayout(layout));
  for (const node of Object.values(repaired.nodes)) {
    const schema = blockPropSchemas[node.type.resolvedName];
    expect(schema?.safeParse(node.props).success).toBe(true);
  }
};

describe("Phase F1 — Pike counters → Counter Section", () => {
  it("converts harvested counters fixture to Counter Section", () => {
    const moduleNode = findFirstModule(extractFixture("layout-sections-module-counters-native.json", "f1-counters"));
    const result = tryConvertHubspotModuleNode(moduleNode, "parent-col");
    expect(result?.blocks).toHaveLength(1);
    const block = result!.blocks[0]!;
    expect(block.node.type.resolvedName).toBe(COUNTER_SECTION_BLOCK);
    expect(block.node.props.stats).toEqual([
      {
        value: "40%",
        label: "Average Cost Savings",
        description: expect.stringContaining("Clients reduce overhead"),
      },
      {
        value: "24/7",
        label: "Global Coverage",
        description: expect.stringContaining("round-the-clock"),
      },
      {
        value: "4000+",
        label: "Businesses Served",
        description: expect.stringContaining("thousands trust"),
      },
    ]);
    expect(
      (block.node.custom?.hubspot as { conversionRole?: string })?.conversionRole,
    ).toBe(NATIVE_COUNTER_SECTION);
    expect(block.nodeId).toBe(
      stableNodeIdFromPath(`${moduleNode.sourcePath}/native/counter_section`),
    );
  });

  it("layout integration: counters-native yields Counter Section without deferral", () => {
    const { layout, deferredModules, diagnostics } = convertHubspotUpmToLayout(
      extractFixture("layout-sections-module-counters-native.json", "f1-counters"),
    );
    expect(deferredModules.length).toBe(0);
    expect(diagnostics.some((d) => d.code === MODULE_CONVERTED_NATIVE)).toBe(true);
    expect(Object.values(layout.nodes).some((n) => n.type.resolvedName === COUNTER_SECTION_BLOCK)).toBe(
      true,
    );
    expectSchemaValid(layout);
  });

  it.each([
    ["missing counters", { path: HUBSPOT_PIKE_COUNTERS_PATH, css_class: "dnd-module" }],
    ["non-array counters", { path: HUBSPOT_PIKE_COUNTERS_PATH, [HUBSPOT_COUNTERS_PARAM_KEY]: {} }],
    ["wrong path", { [HUBSPOT_COUNTERS_PARAM_KEY]: [corpusPikeCounterItem], path: "/other/counters" }],
    [
      "extra top-level",
      {
        path: HUBSPOT_PIKE_COUNTERS_PATH,
        [HUBSPOT_COUNTERS_PARAM_KEY]: [corpusPikeCounterItem],
        extra: "x",
      },
    ],
    [
      "malformed stat number",
      {
        path: HUBSPOT_PIKE_COUNTERS_PATH,
        [HUBSPOT_COUNTERS_PARAM_KEY]: [{ ...corpusPikeCounterItem, stat: { number: "x" } }],
      },
    ],
    [
      "extra item field",
      {
        path: HUBSPOT_PIKE_COUNTERS_PATH,
        [HUBSPOT_COUNTERS_PARAM_KEY]: [{ ...corpusPikeCounterItem, badge: "x" }],
      },
    ],
  ] as const)("defers for %s", (_label, params) => {
    const moduleNode = syntheticModule("/layoutSections/m/rows/0/0", params);
    expect(tryConvertHubspotModuleNode(moduleNode, "parent")).toBeNull();
  });

  it.each([
    ["non-finite number", { number: Number.POSITIVE_INFINITY, prefix: "", suffix: "%", formatted: true, prefix_superscript: false, suffix_superscript: true }],
    ["invalid prefix type", { number: 40, prefix: 100, suffix: "%", formatted: true, prefix_superscript: false, suffix_superscript: true }],
    ["invalid suffix type", { number: 40, prefix: "", suffix: 7, formatted: true, prefix_superscript: false, suffix_superscript: true }],
    ["invalid formatted type", { number: 40, prefix: "", suffix: "%", formatted: "true", prefix_superscript: false, suffix_superscript: true }],
    ["invalid prefix_superscript type", { number: 40, prefix: "", suffix: "%", formatted: true, prefix_superscript: "false", suffix_superscript: true }],
    ["invalid suffix_superscript type", { number: 40, prefix: "", suffix: "%", formatted: true, prefix_superscript: false, suffix_superscript: "true" }],
  ] as const)("defers for Pike stat field: %s", (_label, stat) => {
    const params = {
      path: HUBSPOT_PIKE_COUNTERS_PATH,
      css_class: "dnd-module",
      module_id: 1,
      schema_version: 2,
      [HUBSPOT_COUNTERS_PARAM_KEY]: [{ ...corpusPikeCounterItem, stat }],
    };
    expect(tryConvertHubspotModuleNode(syntheticModule("/m", params), "parent")).toBeNull();
  });
});

describe("Phase F1 — Pike tabs → Tabs", () => {
  const minimalPikeTabsParams = {
    path: HUBSPOT_PIKE_TABS_PATH,
    css_class: "dnd-module",
    schema_version: 2,
    module_id: 194886720807,
    type: "custom_widget",
    [HUBSPOT_TABS_PARAM_KEY]: [corpusPikeTab],
  };

  it("converts minimal corpus-shaped Pike tabs without panel CTAs", () => {
    const moduleNode = syntheticModule("/layoutSections/m/rows/0/0", minimalPikeTabsParams);
    const result = tryConvertHubspotModuleNode(moduleNode, "parent-col");
    expect(result?.blocks[0]?.node.type.resolvedName).toBe(TABS_BLOCK);
    expect(result?.blocks[0]?.node.props.tabs).toEqual([
      {
        label: "Logistics Support",
        content: corpusPikeTab.contents[0]!.content,
      },
    ]);
    expect(
      (result?.blocks[0]?.node.custom?.hubspot as { conversionRole?: string })?.conversionRole,
    ).toBe(NATIVE_TABS);
    const expectedNodeId = stableNodeIdFromPath(`${moduleNode.sourcePath}/native/tabs`);
    expect(expectedNodeId).toBe("hsn_fc862713d2d6acea");
    expect(result?.blocks[0]?.nodeId).toBe(expectedNodeId);
  });

  it("harvested tabs fixture defers because tab panels include CTAs", () => {
    const moduleNode = findFirstModule(extractFixture("layout-sections-module-tabs-native.json", "f1-tabs"));
    expect(tryConvertHubspotModuleNode(moduleNode, "parent")).toBeNull();
    const { deferredModules } = convertHubspotUpmToLayout(
      extractFixture("layout-sections-module-tabs-native.json", "f1-tabs"),
    );
    expect(deferredModules.length).toBe(1);
    expect(
      Object.values(convertHubspotUpmToLayout(extractFixture("layout-sections-module-tabs-native.json")).layout.nodes).some(
        (n) => n.type.resolvedName === GROUP_BLOCK,
      ),
    ).toBe(true);
  });

  it.each([
    ["empty tabs", { ...minimalPikeTabsParams, [HUBSPOT_TABS_PARAM_KEY]: [] }],
    [
      "tab with ctas",
      {
        ...minimalPikeTabsParams,
        [HUBSPOT_TABS_PARAM_KEY]: [
          { ...corpusPikeTab, contents: [{ content: "<p>x</p>", ctas: [{ text: "Go" }] }] },
        ],
      },
    ],
    [
      "multiple contents",
      {
        ...minimalPikeTabsParams,
        [HUBSPOT_TABS_PARAM_KEY]: [
          { ...corpusPikeTab, contents: [{ content: "<p>a</p>" }, { content: "<p>b</p>" }] },
        ],
      },
    ],
    [
      "bare string title",
      {
        ...minimalPikeTabsParams,
        [HUBSPOT_TABS_PARAM_KEY]: [{ ...corpusPikeTab, title: "Nope" }],
      },
    ],
    ["unsupported top-level intro", { ...minimalPikeTabsParams, intro: { heading_line_1: "x" } }],
  ] as const)("defers for %s", (_label, params) => {
    expect(tryConvertHubspotModuleNode(syntheticModule("/m", params), "parent")).toBeNull();
  });
});

describe("Phase F1 — custom steps → Step Cards", () => {
  const minimalStepsParams = {
    css_class: "dnd-module",
    module_id: 218873477754,
    schema_version: 2,
    [HUBSPOT_STEPS_PARAM_KEY]: [
      corpusStepItem,
      { step_title: "Attend", step_description: "<p>Connect with leaders.</p>" },
    ],
  };

  it("converts minimal corpus-shaped steps", () => {
    const moduleNode = syntheticModule("/layoutSections/m/rows/0/0", minimalStepsParams);
    const result = tryConvertHubspotModuleNode(moduleNode, "parent-col");
    expect(result?.blocks[0]?.node.type.resolvedName).toBe(STEP_CARDS_BLOCK);
    expect(result?.blocks[0]?.node.props.steps).toEqual([
      { number: "1", title: "Apply", description: "<p>Request your invitation.</p>" },
      { number: "2", title: "Attend", description: "<p>Connect with leaders.</p>" },
    ]);
    expect(
      (result?.blocks[0]?.node.custom?.hubspot as { conversionRole?: string })?.conversionRole,
    ).toBe(NATIVE_STEP_CARDS);
    const expectedNodeId = stableNodeIdFromPath(`${moduleNode.sourcePath}/native/step_cards`);
    expect(expectedNodeId).toBe("hsn_07f0352968fb02fa");
    expect(result?.blocks[0]?.nodeId).toBe(expectedNodeId);
  });

  it("harvested steps fixture defers due to intro, cta, and style_settings", () => {
    const moduleNode = findFirstModule(extractFixture("layout-sections-module-steps-native.json", "f1-steps"));
    expect(tryConvertHubspotModuleNode(moduleNode, "parent")).toBeNull();
  });

  it.each([
    [
      "step_title_color",
      {
        ...minimalStepsParams,
        [HUBSPOT_STEPS_PARAM_KEY]: [
          { ...corpusStepItem, step_title_color: { color: "#000", opacity: 100 } },
        ],
      },
    ],
    ["intro present", { ...minimalStepsParams, intro: { heading_line_1: "x" } }],
    ["empty steps", { ...minimalStepsParams, [HUBSPOT_STEPS_PARAM_KEY]: [] }],
  ] as const)("defers for %s", (_label, params) => {
    expect(tryConvertHubspotModuleNode(syntheticModule("/m", params), "parent")).toBeNull();
  });
});

describe("Phase F1 — custom stats → Counter Section", () => {
  const minimalStatsParams = {
    css_class: "dnd-module",
    module_id: 218994691436,
    schema_version: 2,
    [HUBSPOT_STATS_PARAM_KEY]: [corpusStatItem],
  };

  it("converts minimal corpus-shaped stats", () => {
    const result = tryConvertHubspotModuleNode(
      syntheticModule("/layoutSections/m/rows/0/0", minimalStatsParams),
      "parent-col",
    );
    expect(result?.blocks[0]?.node.type.resolvedName).toBe(COUNTER_SECTION_BLOCK);
    expect(result?.blocks[0]?.node.props.stats).toEqual([
      {
        value: "5500+",
        label: "Global Employees",
        description: "<p>Supporting businesses globally.</p>",
      },
    ]);
    expect(
      (result?.blocks[0]?.node.custom?.hubspot as { conversionRole?: string })?.conversionRole,
    ).toBe(NATIVE_COUNTER_SECTION);
  });

  it("harvested stats fixture defers due to intro, cta, and style_settings", () => {
    const moduleNode = findFirstModule(extractFixture("layout-sections-module-stats-native.json", "f1-stats"));
    expect(tryConvertHubspotModuleNode(moduleNode, "parent")).toBeNull();
  });

  it.each([
    ["cta present", { ...minimalStatsParams, cta: { button_label: "Apply" } }],
    [
      "extra item field",
      { ...minimalStatsParams, [HUBSPOT_STATS_PARAM_KEY]: [{ ...corpusStatItem, extra: "x" }] },
    ],
    [
      "missing stat_number",
      {
        ...minimalStatsParams,
        [HUBSPOT_STATS_PARAM_KEY]: [{ stat_label: "L", stat_description: "<p>d</p>" }],
      },
    ],
  ] as const)("defers for %s", (_label, params) => {
    expect(tryConvertHubspotModuleNode(syntheticModule("/m", params), "parent")).toBeNull();
  });
});

describe("Phase F1 — empty-array converter selection", () => {
  const minimalStepsParams = {
    css_class: "dnd-module",
    module_id: 1,
    schema_version: 2,
    [HUBSPOT_STEPS_PARAM_KEY]: [corpusStepItem],
  };

  const minimalStatsParams = {
    css_class: "dnd-module",
    module_id: 1,
    schema_version: 2,
    [HUBSPOT_STATS_PARAM_KEY]: [corpusStatItem],
  };

  const minimalPikeTabsParams = {
    path: HUBSPOT_PIKE_TABS_PATH,
    css_class: "dnd-module",
    module_id: 1,
    schema_version: 2,
    type: "custom_widget",
    [HUBSPOT_TABS_PARAM_KEY]: [corpusPikeTab],
  };

  it("does not let empty cards[] block valid steps[] conversion", () => {
    const payload = {
      type: "custom_widget",
      params: {
        [HUBSPOT_CARDS_PARAM_KEY]: [],
        ...minimalStepsParams,
      },
    };
    const result = tryConvertHubspotModuleNode(syntheticModule("/m", payload), "parent");
    expect(result?.blocks[0]?.node.type.resolvedName).toBe(STEP_CARDS_BLOCK);
  });

  it("does not let empty counters[] block valid stats[] conversion", () => {
    const params = {
      [HUBSPOT_COUNTERS_PARAM_KEY]: [],
      ...minimalStatsParams,
    };
    const result = tryConvertHubspotModuleNode(syntheticModule("/m", params), "parent");
    expect(result?.blocks[0]?.node.type.resolvedName).toBe(COUNTER_SECTION_BLOCK);
  });

  it("does not let empty stats[] block valid steps[] conversion", () => {
    const params = {
      [HUBSPOT_STATS_PARAM_KEY]: [],
      ...minimalStepsParams,
    };
    const result = tryConvertHubspotModuleNode(syntheticModule("/m", params), "parent");
    expect(result?.blocks[0]?.node.type.resolvedName).toBe(STEP_CARDS_BLOCK);
  });

  it("does not let empty steps[] block valid Pike tabs conversion", () => {
    const params = {
      [HUBSPOT_STEPS_PARAM_KEY]: [],
      ...minimalPikeTabsParams,
    };
    const result = tryConvertHubspotModuleNode(syntheticModule("/m", params), "parent");
    expect(result?.blocks[0]?.node.type.resolvedName).toBe(TABS_BLOCK);
  });

  it("does not let empty tabs[] block valid steps[] conversion", () => {
    const params = {
      [HUBSPOT_TABS_PARAM_KEY]: [],
      ...minimalStepsParams,
    };
    const result = tryConvertHubspotModuleNode(syntheticModule("/m", params), "parent");
    expect(result?.blocks[0]?.node.type.resolvedName).toBe(STEP_CARDS_BLOCK);
  });

  it("does not convert when only empty complex arrays are present", () => {
    const params = {
      path: HUBSPOT_PIKE_TABS_PATH,
      [HUBSPOT_CARDS_PARAM_KEY]: [],
      [HUBSPOT_COUNTERS_PARAM_KEY]: [],
      [HUBSPOT_STATS_PARAM_KEY]: [],
      [HUBSPOT_STEPS_PARAM_KEY]: [],
      [HUBSPOT_TABS_PARAM_KEY]: [],
    };
    expect(tryConvertHubspotModuleNode(syntheticModule("/m", params), "parent")).toBeNull();
  });
});

describe("Phase F1 — features[] regression", () => {
  it("does not convert params.features to Feature List", () => {
    const moduleNode = syntheticModule("/layoutSections/m/rows/0/0", {
      [HUBSPOT_FEATURES_PARAM_KEY]: [{ title: { text: "Feature A" } }],
    });
    expect(tryConvertHubspotModuleNode(moduleNode, "parent")).toBeNull();
    const { layout } = convertHubspotUpmToLayout({
      ...extractFixture("minimal-page.json"),
      regions: [
        {
          kind: "layout_sections",
          nodes: [moduleNode],
        },
      ],
    });
    expect(Object.values(layout.nodes).some((n) => n.type.resolvedName === FEATURE_LIST_BLOCK)).toBe(
      false,
    );
  });
});

describe("Phase F1 — determinism and non-mutation", () => {
  it("produces deterministic output and does not mutate UPM module payload", () => {
    const params = {
      path: HUBSPOT_PIKE_COUNTERS_PATH,
      css_class: "dnd-module",
      module_id: 1,
      schema_version: 2,
      [HUBSPOT_COUNTERS_PARAM_KEY]: [corpusPikeCounterItem],
    };
    const moduleNode = syntheticModule("/layoutSections/a/rows/0/0", structuredClone(params));
    const payloadBefore = JSON.stringify(moduleNode.payload);
    const first = tryConvertHubspotModuleNode(moduleNode, "parent");
    const second = tryConvertHubspotModuleNode(moduleNode, "parent");
    expect(JSON.stringify(moduleNode.payload)).toBe(payloadBefore);
    expect(first).toEqual(second);

    const alternate = syntheticModule("/layoutSections/b/rows/0/0", params);
    expect(tryConvertHubspotModuleNode(alternate, "parent")!.blocks[0]!.nodeId).not.toBe(
      first!.blocks[0]!.nodeId,
    );
  });
});
