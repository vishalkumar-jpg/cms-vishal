import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { HubspotRawContent } from "../hubspot-api";
import { blockPropSchemas } from "../block-props";
import type { SerializedLayout } from "../layout";
import {
  convertHubspotUpmToLayout,
  extractHubspotUniversalPage,
  HUBSPOT_LAYOUT_GRID_COLUMNS,
  hubspotScopedImportFromSource,
  type HubspotSourceNode,
  type HubspotUniversalPage,
} from "../hubspot-upm";
import {
  COUNTER_SECTION_BLOCK,
  EMBED_BLOCK,
  FEATURE_LIST_BLOCK,
  GROUP_BLOCK,
  HEADING_BLOCK,
  RICH_TEXT_BLOCK,
} from "../resolved-block-names";
import { stableNodeIdFromPath } from "../hubspot-upm/json-utils";

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

const resolvedNames = (layout: SerializedLayout): string[] =>
  Object.values(layout.nodes).map((n) => n.type.resolvedName);

const rootChildMeta = (
  layout: SerializedLayout,
): { resolvedName: string; sourcePath?: string }[] => {
  const root = layout.nodes[layout.root];
  return (root?.nodes ?? []).map((id) => {
    const node = layout.nodes[id];
    const hubspot = node?.custom?.hubspot as { sourcePath?: string } | undefined;
    return { resolvedName: node?.type.resolvedName ?? "", sourcePath: hubspot?.sourcePath };
  });
};

const layoutSignature = (layout: SerializedLayout): string =>
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

const upmWithColumnNodes = (
  columns: { path: string; width?: number; offset?: number }[],
): HubspotUniversalPage => {
  const base = extractFixture("minimal-page.json", "width-test");
  const nodes: HubspotSourceNode[] = columns.map((col, index) => ({
    id: stableNodeIdFromPath(col.path),
    sourcePath: col.path,
    nodeKind: "column",
    payload: {
      ...(col.width !== undefined ? { width: col.width } : {}),
      ...(col.offset !== undefined ? { offset: col.offset } : {}),
      type: "cell",
    },
    htmlFragments:
      index === 0 ? [{ field: "intro", value: "<p>Column layout probe</p>" }] : [],
    children: [],
    provenance: {
      hubspotHsId: "width-test",
      hubspotKind: "page",
      sourcePath: col.path,
      extractionStatus: "ok",
      normalizationStatus: "classified",
    },
  }));
  return { ...base, regions: [{ kind: "layout_sections", nodes }] };
};

describe("convertHubspotUpmToLayout (Phase D)", () => {
  it("multi-section-layout produces multiple top-level sections", () => {
    const { layout, hasStructuralLayout } = convertHubspotUpmToLayout(extractFixture("multi-section-layout.json", "6003"));
    expect(hasStructuralLayout).toBe(true);
    const root = layout.nodes[layout.root]!;
    const topSections = (root.nodes ?? []).filter((id) => layout.nodes[id]?.type.resolvedName === "Section");
    expect(topSections.length).toBe(2);
  });

  it("multi-section-layout converts generic heading module to native Heading", () => {
    const { layout, deferredModules } = convertHubspotUpmToLayout(
      extractFixture("multi-section-layout.json", "6003"),
    );
    expect(resolvedNames(layout)).toContain(HEADING_BLOCK);
    expect(resolvedNames(layout).filter((n) => n === GROUP_BLOCK).length).toBe(0);
    expect(deferredModules.length).toBe(0);
    const heading = Object.values(layout.nodes).find((n) => n.type.resolvedName === HEADING_BLOCK);
    expect(heading?.props.text).toBe("CTA");
  });

  it("layout-sections-module-cards-native converts cards module to Feature List", () => {
    const upm = extractFixture("layout-sections-module-cards-native.json", "3004");
    const { layout, deferredModules } = convertHubspotUpmToLayout(upm);
    expect(deferredModules.length).toBe(0);
    expect(resolvedNames(layout)).toContain(FEATURE_LIST_BLOCK);
    expect(resolvedNames(layout)).not.toContain("Group");
  });

  it("layout-sections-module-counters-native converts Pike counters to Counter Section", () => {
    const upm = extractFixture("layout-sections-module-counters-native.json", "f1-counters");
    const { layout, deferredModules } = convertHubspotUpmToLayout(upm);
    expect(deferredModules.length).toBe(0);
    expect(resolvedNames(layout)).toContain("Counter Section");
    expect(resolvedNames(layout)).not.toContain("Group");
  });

  it("applyHubspotDesign defaults to true when explicitly undefined and disables when false", () => {
    const upm = extractFixture("layout-sections-module-counters-native.json", "h2-apply-flag");
    const withDefault = convertHubspotUpmToLayout(upm, { applyHubspotDesign: undefined });
    const withFalse = convertHubspotUpmToLayout(upm, { applyHubspotDesign: false });
    const counterDefault = Object.values(withDefault.layout.nodes).find(
      (n) => n.type.resolvedName === COUNTER_SECTION_BLOCK,
    );
    const counterDisabled = Object.values(withFalse.layout.nodes).find(
      (n) => n.type.resolvedName === COUNTER_SECTION_BLOCK,
    );
    expect(counterDefault).toBeDefined();
    expect(counterDisabled).toBeDefined();
    expect((counterDefault!.props as Record<string, unknown>).partStyles).toBeDefined();
    expect((counterDisabled!.props as Record<string, unknown>).partStyles).toBeUndefined();
    expect(
      (counterDefault!.custom?.hubspot as { appliedDesignEntryKeys?: string[] })?.appliedDesignEntryKeys
        ?.length,
    ).toBeGreaterThan(0);
    expect(
      (counterDisabled!.custom?.hubspot as { appliedDesignEntryKeys?: string[] })?.appliedDesignEntryKeys,
    ).toBeUndefined();
  });

  it("layout-sections-module defers module with Group placeholder and provenance", () => {
    const upm = extractFixture("layout-sections-module.json", "3003");
    const { layout, deferredModules, diagnostics } = convertHubspotUpmToLayout(upm);
    expect(resolvedNames(layout)).toContain("Group");
    expect(resolvedNames(layout)).not.toContain(FEATURE_LIST_BLOCK);
    expect(resolvedNames(layout)).not.toContain("Cards");
    expect(deferredModules.some((m) => m.moduleId === "cards_group")).toBe(true);
    expect(diagnostics.some((d) => d.code === "LAYOUT_MODULE_DEFERRED")).toBe(true);
    const group = Object.values(layout.nodes).find((n) => n.type.resolvedName === "Group");
    expect((group?.custom?.hubspot as { conversionRole?: string })?.conversionRole).toBe("deferred_module");
    const modulePath = "/layoutSections/dnd_area-main/rows/0/0/rows/0/0";
    expect(
      Object.values(layout.nodes).some(
        (n) => (n.custom?.hubspot as { sourcePath?: string })?.sourcePath === modulePath,
      ),
    ).toBe(true);
  });

  it("sanitizes Rich Text HTML from HubSpot fragments", () => {
    const upm: HubspotUniversalPage = {
      ...extractFixture("minimal-page.json"),
      regions: [
        {
          kind: "widget_containers",
          nodes: [
            {
              id: "field-unsafe",
              sourcePath: "/widgetContainers/main/body",
              nodeKind: "field",
              children: [],
              htmlFragments: [
                { field: "body", value: "<p>ok</p><script>alert(1)</script>" },
              ],
              payload: {},
              provenance: {
                hubspotHsId: "unsafe",
                hubspotKind: "page",
                sourcePath: "/widgetContainers/main/body",
                extractionStatus: "ok",
                normalizationStatus: "html_only",
              },
            },
          ],
        },
      ],
    };
    const { layout } = convertHubspotUpmToLayout(upm);
    const richText = Object.values(layout.nodes).find((n) => n.type.resolvedName === RICH_TEXT_BLOCK);
    expect(richText?.props.html).toBe("<p>ok</p>");
  });

  it("widget-containers are structurally represented", () => {
    const { layout, hasStructuralLayout } = convertHubspotUpmToLayout(extractFixture("widget-containers.json"));
    expect(hasStructuralLayout).toBe(true);
    expect(resolvedNames(layout).some((n) => n === "Container" || n === RICH_TEXT_BLOCK)).toBe(true);
  });

  it("combined-content with includeHtmlBody documents region order", () => {
    const upm = extractFixture("combined-content-page.json", "6002");
    const { layout } = convertHubspotUpmToLayout(upm, { includeHtmlBody: true });
    expect(rootChildMeta(layout).map((c) => c.resolvedName)).toEqual([
      RICH_TEXT_BLOCK,
      "Section",
      "Container",
    ]);
  });

  it("maps column width generically", () => {
    const { layout } = convertHubspotUpmToLayout(
      upmWithColumnNodes([
        { path: "/a", width: 6 },
        { path: "/b", width: 6 },
        { path: "/c", width: 3 },
        { path: "/d", width: 9 },
        { path: "/e", width: 12 },
        { path: "/f" },
      ]),
    );
    const flexValues = Object.values(layout.nodes)
      .filter((n) => n.type.resolvedName === "Column")
      .map((n) => n.props.flex as number);
    expect(flexValues).toContain(6 / HUBSPOT_LAYOUT_GRID_COLUMNS);
    expect(flexValues).toContain(0.5);
    expect(flexValues).toContain(1);
  });

  it("emits LAYOUT_AMBIGUOUS_OFFSET for column offset", () => {
    const { diagnostics } = convertHubspotUpmToLayout(upmWithColumnNodes([{ path: "/o", width: 6, offset: 3 }]));
    expect(diagnostics.some((d) => d.code === "LAYOUT_AMBIGUOUS_OFFSET")).toBe(true);
  });

  it("handles empty structural layout without throwing", () => {
    const result = convertHubspotUpmToLayout(extractFixture("minimal-page.json"));
    expect(result.hasStructuralLayout).toBe(false);
  });

  it("preserves deferred module placeholders when layout canvas is otherwise empty", () => {
    const upm: HubspotUniversalPage = {
      ...extractFixture("minimal-page.json"),
      regions: [
        {
          kind: "layout_sections",
          nodes: [
            {
              id: "mod-only",
              sourcePath: "/layoutSections/widget",
              nodeKind: "module",
              hubspot: { moduleId: "cards_group", moduleType: "custom_widget" },
              payload: {},
              htmlFragments: [],
              children: [],
              provenance: {
                hubspotHsId: "mod-only",
                hubspotKind: "page",
                sourcePath: "/layoutSections/widget",
                extractionStatus: "ok",
                normalizationStatus: "classified",
              },
            },
          ],
        },
      ],
    };
    const { layout, hasStructuralLayout, deferredModules } = convertHubspotUpmToLayout(upm);
    expect(deferredModules.length).toBe(1);
    expect(hasStructuralLayout).toBe(true);
    const group = Object.values(layout.nodes).find((n) => n.type.resolvedName === "Group");
    expect((group?.custom?.hubspot as { conversionRole?: string })?.conversionRole).toBe(
      "deferred_module",
    );
  });

  it("treats empty layoutSections shell as non-structural for embed fallback", () => {
    const upm = extractHubspotUniversalPage({
      raw: { id: "empty-shell", layoutSections: { main: {} }, postBody: "<p>Legacy body</p>" },
      kind: "blog_post",
      hsId: "empty-shell",
      extractedAtIso: EXTRACTED_AT,
    });
    const conversion = convertHubspotUpmToLayout(upm);
    expect(conversion.hasStructuralLayout).toBe(false);

    const scoped = hubspotScopedImportFromSource(
      {
        id: "empty-shell",
        layoutSections: { main: {} },
        postBody: "<p>Legacy body</p>",
      } as HubspotRawContent,
      "blog_post",
      "empty-shell",
      EXTRACTED_AT,
    );
    expect(scoped.hasStructuralLayout).toBe(false);
    const embed = Object.values(scoped.layout.nodes).find((n) => n.type.resolvedName === EMBED_BLOCK);
    expect(embed?.props.html).toContain("<p>Legacy body</p>");
  });

  it("malformed layoutSections keeps extraction diagnostic", () => {
    const upm = extractHubspotUniversalPage({
      raw: { id: "x", layoutSections: "bad" },
      kind: "page",
      hsId: "x",
      extractedAtIso: EXTRACTED_AT,
    });
    expect(() => convertHubspotUpmToLayout(upm)).not.toThrow();
    expect(upm.diagnostics.some((d) => d.code === "INVALID_LAYOUT_SECTIONS")).toBe(true);
  });

  it("unknown empty node emits LAYOUT_UNSUPPORTED_NODE", () => {
    const upm: HubspotUniversalPage = {
      ...extractFixture("minimal-page.json"),
      regions: [
        {
          kind: "layout_sections",
          nodes: [
            {
              id: "u1",
              sourcePath: "/layoutSections/x",
              nodeKind: "unknown",
              children: [],
              htmlFragments: [],
              payload: {},
              provenance: {
                hubspotHsId: "x",
                hubspotKind: "page",
                sourcePath: "/layoutSections/x",
                extractionStatus: "unknown_shape",
                normalizationStatus: "raw_only",
              },
            },
          ],
        },
      ],
    };
    expect(convertHubspotUpmToLayout(upm).diagnostics.some((d) => d.code === "LAYOUT_UNSUPPORTED_NODE")).toBe(true);
  });

  it("is deterministic and does not mutate UPM", () => {
    const upm = extractFixture("multi-section-layout.json");
    const before = JSON.stringify(upm);
    const a = convertHubspotUpmToLayout(upm);
    const b = convertHubspotUpmToLayout(upm);
    expect(JSON.stringify(upm)).toBe(before);
    expect(layoutSignature(a.layout)).toBe(layoutSignature(b.layout));
  });

  it("passes blockPropSchemas after migrate/repair", () => {
    const { layout } = convertHubspotUpmToLayout(extractFixture("layout-sections-module.json", "3003"));
    for (const node of Object.values(layout.nodes)) {
      expect(blockPropSchemas[node.type.resolvedName]).toBeDefined();
    }
  });

  it("hubspotScopedImportFromSource uses structural layout or embed fallback", () => {
    const structural = hubspotScopedImportFromSource(
      loadFixture("layout-sections-module.json") as HubspotRawContent,
      "page",
      "3003",
      EXTRACTED_AT,
    );
    expect(structural.hasStructuralLayout).toBe(true);
    expect(resolvedNames(structural.layout)).toContain("Section");

    const minimal = hubspotScopedImportFromSource(
      loadFixture("minimal-page.json") as HubspotRawContent,
      "page",
      "1001",
      EXTRACTED_AT,
    );
    expect(minimal.hasStructuralLayout).toBe(false);
    const contentNodes = Object.values(minimal.layout.nodes).filter((n) => n.parent !== null);
    expect(contentNodes.map((n) => n.type.resolvedName)).toEqual(["Embed"]);
  });
});
