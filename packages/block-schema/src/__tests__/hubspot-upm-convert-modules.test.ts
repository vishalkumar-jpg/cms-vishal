import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { blockPropSchemas } from "../block-props";
import { migrate, repairLayout } from "../index";
import {
  convertHubspotUpmToLayout,
  extractHubspotUniversalPage,
  MODULE_CONVERTED_NATIVE,
  NATIVE_FEATURE_LIST,
  NATIVE_HEADING,
  NATIVE_RICH_TEXT,
  tryConvertHubspotModuleNode,
  type HubspotSourceNode,
  type HubspotUniversalPage,
} from "../hubspot-upm";
import { hubspotNativeModuleEmitMetadata } from "../hubspot-upm/hubspot-native-module-emit";
import { stableNodeIdFromPath } from "../hubspot-upm/json-utils";
import {
  FEATURE_LIST_BLOCK,
  GROUP_BLOCK,
  HEADING_BLOCK,
  RICH_TEXT_BLOCK,
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

const findModuleNodeByParamsHeading = (upm: HubspotUniversalPage): HubspotSourceNode | undefined => {
  const visit = (nodes: HubspotSourceNode[]): HubspotSourceNode | undefined => {
    for (const node of nodes) {
      if (node.nodeKind !== "module") {
        const child = visit(node.children);
        if (child) return child;
        continue;
      }
      const payload = node.payload;
      if (
        payload &&
        typeof payload === "object" &&
        !Array.isArray(payload) &&
        payload.params &&
        typeof payload.params === "object" &&
        !Array.isArray(payload.params) &&
        typeof (payload.params as Record<string, unknown>).heading === "string"
      ) {
        return node;
      }
      const nested = visit(node.children);
      if (nested) return nested;
    }
    return undefined;
  };
  for (const region of upm.regions) {
    const found = visit(region.nodes);
    if (found) return found;
  }
  return undefined;
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
  overrides: Partial<HubspotSourceNode> & Pick<HubspotSourceNode, "payload">,
): HubspotSourceNode => ({
  id: "mod-synthetic",
  sourcePath,
  nodeKind: "module",
  hubspot: { moduleId: "synthetic_mod", moduleType: "custom_widget" },
  htmlFragments: [],
  children: [],
  provenance: baseModuleProvenance(sourcePath),
  ...overrides,
});

const layoutSignature = (layout: ReturnType<typeof convertHubspotUpmToLayout>["layout"]): string =>
  JSON.stringify(
    Object.entries(layout.nodes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, node]) => [
        id,
        node.type.resolvedName,
        node.parent,
        [...(node.nodes ?? [])].join(","),
      ]),
  );

describe("tryConvertHubspotModuleNode (Phase E)", () => {
  it("converts generic params.heading string to native Heading", () => {
    const upm = extractFixture("multi-section-layout.json", "6003");
    const moduleNode = findModuleNodeByParamsHeading(upm);
    expect(moduleNode).toBeDefined();

    const result = tryConvertHubspotModuleNode(moduleNode!, "col-parent");
    expect(result).not.toBeNull();
    expect(result!.blocks.length).toBe(1);
    expect(result!.blocks[0]!.node.type.resolvedName).toBe(HEADING_BLOCK);
    expect(result!.blocks[0]!.node.props.text).toBe("CTA");
    expect(
      (result!.blocks[0]!.node.custom?.hubspot as { conversionRole?: string })?.conversionRole,
    ).toBe(NATIVE_HEADING);
    const expectedNodeId = stableNodeIdFromPath(`${moduleNode!.sourcePath}/native/heading`);
    expect(expectedNodeId).toBe("hsn_09b2eac35ac1c2b7");
    expect(result!.blocks[0]!.nodeId).toBe(expectedNodeId);
  });

  it("multi-section layout uses Heading instead of deferred Group for heading-only module", () => {
    const upm = extractFixture("multi-section-layout.json", "6003");
    const { layout, deferredModules, diagnostics } = convertHubspotUpmToLayout(upm);

    const headingModulePath = findModuleNodeByParamsHeading(upm)!.sourcePath;
    const nativeHeading = Object.values(layout.nodes).find(
      (n) =>
        n.type.resolvedName === HEADING_BLOCK &&
        (n.custom?.hubspot as { sourcePath?: string })?.sourcePath === headingModulePath,
    );
    expect(nativeHeading).toBeDefined();
    expect(nativeHeading?.props.text).toBe("CTA");
    expect(
      (nativeHeading?.custom?.hubspot as { conversionRole?: string })?.conversionRole,
    ).toBe(NATIVE_HEADING);

    expect(
      Object.values(layout.nodes).some(
        (n) =>
          n.type.resolvedName === GROUP_BLOCK &&
          (n.custom?.hubspot as { sourcePath?: string })?.sourcePath === headingModulePath,
      ),
    ).toBe(false);

    expect(deferredModules.some((m) => m.sourcePath === headingModulePath)).toBe(false);
    expect(diagnostics.some((d) => d.code === MODULE_CONVERTED_NATIVE)).toBe(true);
    expect(resolvedNames(layout).filter((n) => n === GROUP_BLOCK).length).toBe(0);
  });

  it("layout-sections-module keeps complex cards params deferred", () => {
    const upm = extractFixture("layout-sections-module.json", "3003");
    const { layout, deferredModules, diagnostics } = convertHubspotUpmToLayout(upm);

    expect(deferredModules.length).toBe(1);
    expect(diagnostics.some((d) => d.code === "LAYOUT_MODULE_DEFERRED")).toBe(true);
    expect(resolvedNames(layout)).toContain(GROUP_BLOCK);
    expect(resolvedNames(layout)).not.toContain(FEATURE_LIST_BLOCK);
    expect(resolvedNames(layout)).not.toContain("Step Cards");
    expect(resolvedNames(layout)).not.toContain("Card");
  });

  it("converts module htmlFragments to sanitized Rich Text", () => {
    const moduleNode: HubspotSourceNode = {
      id: "mod-html",
      sourcePath: "/layoutSections/main/rows/0/0",
      nodeKind: "module",
      hubspot: { moduleId: "generic_html_mod", moduleType: "custom_widget" },
      payload: { type: "custom_widget", params: {} },
      htmlFragments: [{ field: "html", value: "<p>ok</p><script>alert(1)</script>" }],
      children: [],
      provenance: {
        hubspotHsId: "x",
        hubspotKind: "page",
        sourcePath: "/layoutSections/main/rows/0/0",
        extractionStatus: "ok",
        normalizationStatus: "classified",
      },
    };

    const result = tryConvertHubspotModuleNode(moduleNode, "parent-col");
    expect(result?.blocks[0]?.node.type.resolvedName).toBe(RICH_TEXT_BLOCK);
    expect(result?.blocks[0]?.node.props.html).toBe("<p>ok</p>");
    expect(
      (result?.blocks[0]?.node.custom?.hubspot as { conversionRole?: string })?.conversionRole,
    ).toBe(NATIVE_RICH_TEXT);
    const expectedNodeId = stableNodeIdFromPath(`${moduleNode.sourcePath}/native/rich_text`);
    expect(expectedNodeId).toBe("hsn_208f210f68007cc2");
    expect(result?.blocks[0]?.nodeId).toBe(expectedNodeId);
  });

  it("converts object-form heading with text only", () => {
    const moduleNode = syntheticModule("/layoutSections/m/rows/0/0", {
      payload: {
        type: "custom_widget",
        params: { heading: { text: "Title only" } },
      },
    });
    const result = tryConvertHubspotModuleNode(moduleNode, "parent");
    expect(result?.blocks[0]?.node.type.resolvedName).toBe(HEADING_BLOCK);
    expect(result?.blocks[0]?.node.props.text).toBe("Title only");
    expect(result?.blocks[0]?.nodeId).toBe(
      stableNodeIdFromPath(`${moduleNode.sourcePath}/native/heading`),
    );
  });

  it("defers when object-form heading text is malformed and HTML is convertible", () => {
    const moduleNode = syntheticModule("/layoutSections/m/rows/0/0", {
      payload: {
        type: "custom_widget",
        params: { heading: { text: {} } },
      },
      htmlFragments: [{ field: "html", value: "<p>Intro</p>" }],
    });
    expect(tryConvertHubspotModuleNode(moduleNode, "parent")).toBeNull();

    const upm: HubspotUniversalPage = {
      ...extractFixture("minimal-page.json"),
      regions: [{ kind: "layout_sections", nodes: [moduleNode] }],
    };
    const { layout, deferredModules, diagnostics } = convertHubspotUpmToLayout(upm);
    expect(deferredModules.length).toBe(1);
    expect(diagnostics.some((d) => d.code === "LAYOUT_MODULE_DEFERRED")).toBe(true);
    expect(Object.values(layout.nodes).some((n) => n.type.resolvedName === GROUP_BLOCK)).toBe(true);
    expect(Object.values(layout.nodes).some((n) => n.type.resolvedName === RICH_TEXT_BLOCK)).toBe(
      false,
    );
  });

  it("defers when object-form heading has unsupported non-empty properties", () => {
    const moduleNode = syntheticModule("/layoutSections/m/rows/0/0", {
      payload: {
        type: "custom_widget",
        params: { heading: { text: "Title", level: "h2" } },
      },
    });
    expect(tryConvertHubspotModuleNode(moduleNode, "parent")).toBeNull();

    const upm: HubspotUniversalPage = {
      ...extractFixture("minimal-page.json"),
      regions: [{ kind: "layout_sections", nodes: [moduleNode] }],
    };
    const { layout, deferredModules, diagnostics } = convertHubspotUpmToLayout(upm);
    expect(deferredModules.length).toBe(1);
    expect(diagnostics.some((d) => d.code === "LAYOUT_MODULE_DEFERRED")).toBe(true);
    expect(Object.values(layout.nodes).some((n) => n.type.resolvedName === GROUP_BLOCK)).toBe(true);
  });

  it("defers when cards coexist with convertible heading", () => {
    const moduleNode = syntheticModule("/layoutSections/m/rows/0/0", {
      payload: {
        type: "custom_widget",
        params: { heading: "Title", cards: [{ title: { text: "Card" } }] },
      },
    });
    expect(tryConvertHubspotModuleNode(moduleNode, "parent")).toBeNull();
  });

  it("defers when cards coexist with convertible HTML", () => {
    const moduleNode = syntheticModule("/layoutSections/m/rows/0/0", {
      payload: { type: "custom_widget", params: { cards: [{ title: { text: "Card" } }] } },
      htmlFragments: [{ field: "html", value: "<p>Body</p>" }],
    });
    expect(tryConvertHubspotModuleNode(moduleNode, "parent")).toBeNull();
  });

  it("defers when image or CTA params coexist with convertible heading", () => {
    const withImage = syntheticModule("/layoutSections/m/a", {
      payload: {
        type: "custom_widget",
        params: { heading: "Title", image: { src: "https://cdn.example.com/a.png" } },
      },
    });
    const withCta = syntheticModule("/layoutSections/m/b", {
      payload: {
        type: "custom_widget",
        params: { heading: "Title", cta: { label: "Go", url: "/go" } },
      },
    });
    expect(tryConvertHubspotModuleNode(withImage, "parent")).toBeNull();
    expect(tryConvertHubspotModuleNode(withCta, "parent")).toBeNull();
  });

  it("allows heading and HTML together when params contain no unsupported content", () => {
    const moduleNode = syntheticModule("/layoutSections/m/rows/0/0", {
      payload: { type: "custom_widget", params: { heading: "Title" } },
      htmlFragments: [{ field: "html", value: "<p>Intro</p>" }],
    });
    const result = tryConvertHubspotModuleNode(moduleNode, "parent");
    expect(result?.blocks.length).toBe(2);
    expect(result?.blocks.map((b) => b.node.type.resolvedName)).toEqual([
      RICH_TEXT_BLOCK,
      HEADING_BLOCK,
    ]);
  });

  it("preserves structural ancestry for native Heading", () => {
    const { layout } = convertHubspotUpmToLayout(extractFixture("multi-section-layout.json", "6003"));
    const heading = Object.values(layout.nodes).find((n) => n.type.resolvedName === HEADING_BLOCK);
    expect(heading).toBeDefined();

    const parent = heading?.parent ? layout.nodes[heading.parent] : undefined;
    expect(parent?.type.resolvedName).toBe("Container");
    const section = parent?.parent ? layout.nodes[parent.parent] : undefined;
    expect(section?.type.resolvedName).toBe("Section");
    expect(parent?.nodes).toContain(
      Object.entries(layout.nodes).find(([, n]) => n === heading)?.[0],
    );
  });

  it("defers unknown custom widget without heading or html fragments", () => {
    const moduleNode: HubspotSourceNode = {
      id: "mod-unknown",
      sourcePath: "/layoutSections/x/rows/0/0",
      nodeKind: "module",
      hubspot: { moduleId: "unknown_widget", moduleType: "custom_widget" },
      payload: { type: "custom_widget", params: { foo: "bar" } },
      htmlFragments: [],
      children: [],
      provenance: {
        hubspotHsId: "x",
        hubspotKind: "page",
        sourcePath: "/layoutSections/x/rows/0/0",
        extractionStatus: "ok",
        normalizationStatus: "classified",
      },
    };

    expect(tryConvertHubspotModuleNode(moduleNode, "parent")).toBeNull();

    const upm: HubspotUniversalPage = {
      ...extractFixture("minimal-page.json"),
      regions: [{ kind: "layout_sections", nodes: [moduleNode] }],
    };
    const { layout, deferredModules, diagnostics } = convertHubspotUpmToLayout(upm);
    expect(deferredModules.length).toBe(1);
    expect(diagnostics.some((d) => d.code === "LAYOUT_MODULE_DEFERRED")).toBe(true);
    expect(Object.values(layout.nodes).some((n) => n.type.resolvedName === GROUP_BLOCK)).toBe(true);
  });

  it("does not mutate UPM input", () => {
    const upm = extractFixture("multi-section-layout.json", "6003");
    const before = JSON.stringify(upm);
    convertHubspotUpmToLayout(upm);
    expect(JSON.stringify(upm)).toBe(before);
  });

  it("is deterministic", () => {
    const upm = extractFixture("multi-section-layout.json", "6003");
    const a = convertHubspotUpmToLayout(upm);
    const b = convertHubspotUpmToLayout(upm);
    expect(layoutSignature(a.layout)).toBe(layoutSignature(b.layout));
  });

  it("converted layout passes migrate/repair and blockPropSchemas", () => {
    const { layout } = convertHubspotUpmToLayout(extractFixture("multi-section-layout.json", "6003"));
    const repaired = migrate(repairLayout(layout));
    for (const node of Object.values(repaired.nodes)) {
      const schema = blockPropSchemas[node.type.resolvedName];
      expect(schema).toBeDefined();
      expect(schema?.safeParse(node.props).success).toBe(true);
    }
  });
});

describe("tryConvertHubspotModuleNode (Phase F — cards → Feature List)", () => {
  const corpusCard = {
    title: { text: "Card A" },
    image: { src: "https://cdn.example.com/a.png" },
  };

  it("converts native-eligible cards fixture to Feature List without columns prop", () => {
    const upm = extractFixture("layout-sections-module-cards-native.json", "3004");
    const modulePath = "/layoutSections/dnd_area-main/rows/0/0/rows/0/0";
    const moduleNode = ((): HubspotSourceNode | undefined => {
      const visit = (nodes: HubspotSourceNode[]): HubspotSourceNode | undefined => {
        for (const node of nodes) {
          if (node.sourcePath === modulePath) return node;
          const nested = visit(node.children);
          if (nested) return nested;
        }
        return undefined;
      };
      for (const region of upm.regions) {
        const found = visit(region.nodes);
        if (found) return found;
      }
      return undefined;
    })();
    expect(moduleNode).toBeDefined();

    const result = tryConvertHubspotModuleNode(moduleNode!, "parent-col");
    expect(result?.blocks).toHaveLength(1);
    const block = result!.blocks[0]!;
    expect(block.node.type.resolvedName).toBe(FEATURE_LIST_BLOCK);
    expect(block.node.props.columns).toBeUndefined();
    expect(block.node.props.features).toEqual([
      { title: "Card A", icon: "https://cdn.example.com/a.png" },
    ]);
    expect(
      (block.node.custom?.hubspot as { conversionRole?: string })?.conversionRole,
    ).toBe(NATIVE_FEATURE_LIST);

    const expectedNodeId = stableNodeIdFromPath(`${modulePath}/native/feature_list`);
    expect(block.nodeId).toBe(expectedNodeId);
    expect(block.node.parent).toBe("parent-col");

    const alternatePath = "/layoutSections/other-area/rows/0/0/rows/0/0";
    const alternateNode = syntheticModule(alternatePath, {
      payload: moduleNode!.payload,
    });
    const alternateResult = tryConvertHubspotModuleNode(alternateNode, "parent-col");
    expect(alternateResult?.blocks).toHaveLength(1);
    const alternateNodeId = stableNodeIdFromPath(`${alternatePath}/native/feature_list`);
    expect(alternateResult!.blocks[0]!.nodeId).toBe(alternateNodeId);
    expect(alternateResult!.blocks[0]!.nodeId).not.toBe(block.nodeId);
  });

  it("layout integration: native cards fixture yields Feature List and section Rich Text", () => {
    const { layout, deferredModules, diagnostics } = convertHubspotUpmToLayout(
      extractFixture("layout-sections-module-cards-native.json", "3004"),
    );
    expect(deferredModules.length).toBe(0);
    expect(diagnostics.some((d) => d.code === MODULE_CONVERTED_NATIVE)).toBe(true);
    expect(resolvedNames(layout)).toContain(FEATURE_LIST_BLOCK);
    expect(resolvedNames(layout)).toContain(RICH_TEXT_BLOCK);
    expect(resolvedNames(layout)).not.toContain(GROUP_BLOCK);

    const featureList = Object.values(layout.nodes).find(
      (n) => n.type.resolvedName === FEATURE_LIST_BLOCK,
    );
    expect(featureList?.props.features).toEqual([
      { title: "Card A", icon: "https://cdn.example.com/a.png" },
    ]);
  });

  it("allows card with title object text only (optional icon)", () => {
    const moduleNode = syntheticModule("/layoutSections/m/rows/0/0", {
      payload: {
        type: "custom_widget",
        params: { cards: [{ title: { text: "Title only" } }] },
      },
    });
    const result = tryConvertHubspotModuleNode(moduleNode, "parent");
    expect(result?.blocks[0]?.node.props.features).toEqual([{ title: "Title only" }]);
  });

  it("rejects bare-string card title (corpus uses object text only)", () => {
    const moduleNode = syntheticModule("/layoutSections/m/rows/0/0", {
      payload: {
        type: "custom_widget",
        params: { cards: [{ title: "Card A" }] },
      },
    });
    expect(tryConvertHubspotModuleNode(moduleNode, "parent")).toBeNull();
  });

  it.each([
    ["styles", { cards: [corpusCard], styles: { gap: "24px" } }],
    ["heading", { cards: [corpusCard], heading: "Title" }],
    ["unknown top-level", { cards: [corpusCard], extra: "x" }],
    ["empty cards", { cards: [] }],
    ["malformed title text", { cards: [{ title: { text: {} } }] }],
    ["unsupported item field", { cards: [{ ...corpusCard, link: { url: "/x" } }] }],
    ["malformed image src", { cards: [{ title: { text: "T" }, image: { src: {} } }] }],
    ["extra image field", { cards: [{ title: { text: "T" }, image: { src: "https://a", alt: "x" } }] }],
  ] as const)("defers for %s", (_label, params) => {
    const moduleNode = syntheticModule("/layoutSections/m/rows/0/0", {
      payload: { type: "custom_widget", params: { ...params } },
    });
    expect(tryConvertHubspotModuleNode(moduleNode, "parent")).toBeNull();
  });

  it("converted cards layout passes migrate/repair and blockPropSchemas", () => {
    const { layout } = convertHubspotUpmToLayout(
      extractFixture("layout-sections-module-cards-native.json", "3004"),
    );
    const repaired = migrate(repairLayout(layout));
    for (const node of Object.values(repaired.nodes)) {
      const schema = blockPropSchemas[node.type.resolvedName];
      expect(schema?.safeParse(node.props).success).toBe(true);
    }
  });
});

describe("hubspotNativeModuleEmitMetadata", () => {
  it("ignores inherited object keys", () => {
    expect(hubspotNativeModuleEmitMetadata("constructor")).toBeUndefined();
    expect(hubspotNativeModuleEmitMetadata("toString")).toBeUndefined();
  });
});

const resolvedNames = (layout: { nodes: Record<string, { type: { resolvedName: string } }> }): string[] =>
  Object.values(layout.nodes).map((n) => n.type.resolvedName);
