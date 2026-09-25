import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeHubspotContent, type HubspotRawContent } from "../hubspot-api";
import {
  canonicalizeHubspotUniversalPage,
  deriveLegacyImportHtml,
  extractHubspotUniversalPage,
  hubspotImportNormalizedFromSource,
  hubspotUniversalPageDigest,
  isHubspotModuleLike,
  withHubspotUniversalPageDigest,
} from "../hubspot-upm";
import { readModuleParams } from "../hubspot-upm/convert-module-params";
import {
  HUBSPOT_GALLERY_PARAM_KEY,
  HUBSPOT_IMAGE_PARAM_KEY,
  HUBSPOT_IMG_PARAM_KEY,
  HUBSPOT_LOGOS_PARAM_KEY,
} from "../hubspot-upm/complex-module-param-keys";
import { stableNodeIdFromPath } from "../hubspot-upm/json-utils";
import {
  HUBSPOT_UNIVERSAL_PAGE_MODEL_VERSION,
  type HubspotContentRegion,
  type HubspotSourceNode,
  type HubspotUniversalPage,
} from "../hubspot-upm/types";

const FIXTURES_DIR = join(import.meta.dir, "fixtures/hubspot");
const EXTRACTED_AT = "2026-01-01T00:00:00.000Z";

const expectLayoutSectionsRegion = (upm: HubspotUniversalPage): HubspotContentRegion => {
  const layoutRegion = upm.regions.find((r) => r.kind === "layout_sections");
  expect(layoutRegion).toBeDefined();
  if (!layoutRegion) {
    throw new Error("expected layout_sections region from extraction");
  }
  return layoutRegion;
};

const loadFixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(FIXTURES_DIR, name), "utf8")) as Record<string, unknown>;

const findFixtureModuleParams = (raw: Record<string, unknown>): Record<string, unknown> => {
  const visit = (value: unknown): Record<string, unknown> | undefined => {
    if (!value || typeof value !== "object") return undefined;
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = visit(item);
        if (found) return found;
      }
      return undefined;
    }
    const obj = value as Record<string, unknown>;
    const nested = obj.params;
    if (
      nested &&
      typeof nested === "object" &&
      !Array.isArray(nested) &&
      ("module_id" in nested || "path" in nested)
    ) {
      return nested as Record<string, unknown>;
    }
    for (const child of Object.values(obj)) {
      const found = visit(child);
      if (found) return found;
    }
    return undefined;
  };
  const params = visit(raw.layoutSections);
  if (!params) throw new Error("expected module params in fixture");
  return params;
};

const extractFixture = (
  name: string,
  kind: "page" | "blog_post" = "page",
  hsId = "fixture-id",
) =>
  extractHubspotUniversalPage({
    raw: loadFixture(name),
    kind,
    hsId,
    extractedAtIso: EXTRACTED_AT,
  });

describe("hubspot universal page extraction", () => {
  test("digest is stable for identical extraction input", () => {
    const raw = loadFixture("minimal-page.json");
    const first = extractHubspotUniversalPage({
      raw,
      kind: "page",
      hsId: "1001",
      extractedAtIso: EXTRACTED_AT,
    });
    const second = extractHubspotUniversalPage({
      raw,
      kind: "page",
      hsId: "1001",
      extractedAtIso: EXTRACTED_AT,
    });
    expect(first.digest).toBe(second.digest);
    expect(first.digest).toBe(hubspotUniversalPageDigest(first));
  });

  test("hubspotImportNormalizedFromSource matches normalizeHubspotContent for fixtures", () => {
    for (const file of [
      "minimal-page.json",
      "blog-post.json",
      "layout-sections-module.json",
      "widget-containers.json",
      "body-object-page.json",
      "combined-content-page.json",
      "multi-section-layout.json",
    ]) {
      const raw = loadFixture(file) as HubspotRawContent;
      const kind = file.includes("blog") ? "blog_post" : "page";
      const fromUpm = hubspotImportNormalizedFromSource(
        raw,
        kind,
        String(raw.id ?? "fixture"),
        EXTRACTED_AT,
      );
      expect(fromUpm).toEqual(normalizeHubspotContent(raw));
    }
  });

  test("legacy import HTML matches normalizeHubspotContent for fixtures", () => {
    for (const file of [
      "minimal-page.json",
      "blog-post.json",
      "layout-sections-module.json",
      "widget-containers.json",
      "body-object-page.json",
      "combined-content-page.json",
      "multi-section-layout.json",
    ]) {
      const raw = loadFixture(file) as HubspotRawContent;
      const upm = extractFixture(file, file.includes("blog") ? "blog_post" : "page", String(raw.id));
      const legacyHtml = deriveLegacyImportHtml(upm.legacyHtmlParts);
      const normalizedHtml = normalizeHubspotContent(raw).html;
      expect(legacyHtml).toBe(normalizedHtml);
    }
  });

  test("metadata uses absent status instead of inventing title defaults", () => {
    const upm = extractHubspotUniversalPage({
      raw: { slug: "orphan-slug" },
      kind: "page",
      hsId: "x",
      extractedAtIso: EXTRACTED_AT,
    });
    expect(upm.metadata.title.status).toBe("absent");
    expect(upm.metadata.slug.status).toBe("present");
  });

  test("layout module params and styles are preserved on source nodes", () => {
    const upm = extractFixture("layout-sections-module.json", "page", "3003");
    const layoutRegion = expectLayoutSectionsRegion(upm);

    const modules: { moduleType?: string; payload: unknown }[] = [];
    const visit = (nodes: HubspotSourceNode[]): void => {
      for (const node of nodes) {
        if (node.nodeKind === "module") {
          modules.push({ moduleType: node.hubspot?.moduleType, payload: node.payload });
        }
        visit(node.children);
      }
    };
    visit(layoutRegion.nodes);

    expect(modules.some((m) => m.moduleType === "custom_widget" || m.moduleType === "cell")).toBe(
      true,
    );
    const cardsModule = modules.find(
      (m) =>
        typeof m.payload === "object" &&
        m.payload !== null &&
        "module_id" in (m.payload as Record<string, unknown>),
    );
    expect(cardsModule).toBeDefined();
    expect(isHubspotModuleLike(cardsModule!.payload as Record<string, unknown>)).toBe(true);
  });

  test("unmapped top-level HubSpot fields remain on sourceRecord with diagnostics", () => {
    const upm = extractFixture("unmapped-top-level.json", "page", "5005");
    expect(upm.diagnostics.some((d) => d.code === "UNMAPPED_TOP_LEVEL_FIELD")).toBe(true);
    const record = upm.sourceRecord as Record<string, unknown>;
    expect(record.customHubspotField).toEqual({ nested: true });
  });

  test("collects http(s) asset URLs with stable paths", () => {
    const upm = extractFixture("layout-sections-module.json", "page", "3003");
    expect(upm.assets.some((a) => a.url === "https://cdn.example.com/a.png")).toBe(true);
  });

  test("canonicalize produces sorted keys at sourceRecord root", () => {
    const upm = extractFixture("minimal-page.json", "page", "1001");
    const canonical = canonicalizeHubspotUniversalPage(upm);
    const keys = Object.keys((canonical.sourceRecord as Record<string, unknown>) ?? {});
    expect(keys).toEqual([...keys].sort());
  });

  test("digest changes when canonical content changes", () => {
    const base = extractFixture("minimal-page.json", "page", "1001");
    const changed = extractHubspotUniversalPage({
      raw: { ...loadFixture("minimal-page.json"), name: "About v2" },
      kind: "page",
      hsId: "1001",
      extractedAtIso: EXTRACTED_AT,
    });
    expect(base.digest).not.toBe(changed.digest);
  });

  test("digest is unchanged when nested object key order differs in raw input", () => {
    const rawA = {
      slug: "about",
      name: "About",
      nested: { z: 1, a: 2 },
    };
    const rawB = {
      name: "About",
      nested: { a: 2, z: 1 },
      slug: "about",
    };
    const upmA = extractHubspotUniversalPage({
      raw: rawA,
      kind: "page",
      hsId: "1001",
      extractedAtIso: EXTRACTED_AT,
    });
    const upmB = extractHubspotUniversalPage({
      raw: rawB,
      kind: "page",
      hsId: "1001",
      extractedAtIso: EXTRACTED_AT,
    });
    expect(upmA.digest).toBe(upmB.digest);
  });

  test("digest changes when modelVersion changes", () => {
    const upm = extractFixture("minimal-page.json", "page", "1001");
    const { digest: _digest, ...rest } = upm;
    const bumped = withHubspotUniversalPageDigest({
      ...rest,
      modelVersion: "2" as typeof HUBSPOT_UNIVERSAL_PAGE_MODEL_VERSION,
    });
    expect(upm.digest).not.toBe(bumped.digest);
  });

  test("stableNodeIdFromPath avoids collisions for distinct layout section paths", () => {
    const idD2 = stableNodeIdFromPath("/layoutSections/d2");
    const idFp = stableNodeIdFromPath("/layoutSections/fp");
    expect(idD2).toMatch(/^hsn_[0-9a-f]+$/);
    expect(idFp).toMatch(/^hsn_[0-9a-f]+$/);
    expect(idD2).not.toBe(idFp);
  });

  test("layout column with only generic id is traversed and retains nested modules", () => {
    const raw = {
      layoutSections: {
        "dnd_area-main": {
          id: "section-only-id",
          rows: [
            {
              "0": {
                id: "column-only-id",
                type: "cell",
                width: 12,
                rows: [
                  {
                    "0": {
                      type: "custom_widget",
                      module_id: "nested_widget",
                      params: { title: "Nested" },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    };
    expect(isHubspotModuleLike({ id: "column-only-id", type: "cell", width: 12, rows: [] })).toBe(
      false,
    );
    const upm = extractHubspotUniversalPage({
      raw,
      kind: "page",
      hsId: "col-test",
      extractedAtIso: EXTRACTED_AT,
    });
    const layoutRegion = expectLayoutSectionsRegion(upm);
    const moduleNodes: string[] = [];
    const visit = (nodes: HubspotSourceNode[]): void => {
      for (const node of nodes) {
        if (node.nodeKind === "module") moduleNodes.push(node.hubspot?.moduleId ?? "");
        visit(node.children);
      }
    };
    visit(layoutRegion.nodes);
    expect(moduleNodes).toContain("nested_widget");
  });

  test("array children reference the array node as parentNodeId", () => {
    const raw = {
      layoutSections: {
        arr_section: {
          items: [{ type: "custom_widget", module_id: "in_array", params: {} }],
        },
      },
    };
    const upm = extractHubspotUniversalPage({
      raw,
      kind: "page",
      hsId: "arr-test",
      extractedAtIso: EXTRACTED_AT,
    });
    const layoutRegion = expectLayoutSectionsRegion(upm);
    const sectionNode = layoutRegion.nodes[0];
    const arrayPath = "/layoutSections/arr_section/items";
    const arrayNodeId = stableNodeIdFromPath(arrayPath);
    const arrayNode = sectionNode?.children.find((n) => n.sourcePath === arrayPath);
    expect(arrayNode?.id).toBe(arrayNodeId);
    const child = arrayNode?.children[0];
    expect(child?.provenance.parentNodeId).toBe(arrayNodeId);
  });

  test("tagIds metadata preserves empty array and rejects mixed invalid entries", () => {
    const empty = extractHubspotUniversalPage({
      raw: { tagIds: [] },
      kind: "blog_post",
      hsId: "t1",
      extractedAtIso: EXTRACTED_AT,
    });
    expect(empty.metadata.tagIds).toEqual({
      status: "present",
      source: [],
      normalized: [],
    });

    const valid = extractHubspotUniversalPage({
      raw: { tagIds: [1, 2, 3] },
      kind: "blog_post",
      hsId: "t2",
      extractedAtIso: EXTRACTED_AT,
    });
    expect(valid.metadata.tagIds).toEqual({
      status: "present",
      source: [1, 2, 3],
      normalized: [1, 2, 3],
    });

    const mixed = extractHubspotUniversalPage({
      raw: { tagIds: [1, "two", 3] },
      kind: "blog_post",
      hsId: "t3",
      extractedAtIso: EXTRACTED_AT,
    });
    expect(mixed.metadata.tagIds.status).toBe("unparseable");

    const missing = extractHubspotUniversalPage({
      raw: { name: "No tags" },
      kind: "blog_post",
      hsId: "t4",
      extractedAtIso: EXTRACTED_AT,
    });
    expect(missing.metadata.tagIds.status).toBe("absent");
  });

  test("F1 corpus fixtures extract layout modules with target param keys preserved", () => {
    const cases: { file: string; paramKey: string }[] = [
      { file: "layout-sections-module-tabs-native.json", paramKey: "tabs" },
      { file: "layout-sections-module-counters-native.json", paramKey: "counters" },
      { file: "layout-sections-module-steps-native.json", paramKey: "steps" },
      { file: "layout-sections-module-stats-native.json", paramKey: "stats" },
    ];

    for (const { file, paramKey } of cases) {
      const upm = extractFixture(file, "page", `f1-${paramKey}`);
      const layoutRegion = expectLayoutSectionsRegion(upm);
      const modules: HubspotSourceNode[] = [];
      const visit = (nodes: HubspotSourceNode[]): void => {
        for (const node of nodes) {
          if (node.nodeKind === "module") modules.push(node);
          visit(node.children);
        }
      };
      visit(layoutRegion.nodes);

      expect(modules.length).toBe(1);
      const payload = modules[0]!.payload as Record<string, unknown>;
      expect(isHubspotModuleLike(payload)).toBe(true);
      expect(Array.isArray(payload[paramKey])).toBe(true);
      expect((payload[paramKey] as unknown[]).length).toBeGreaterThan(0);
    }
  });

  test("F2 corpus fixtures extract layout modules with target param keys preserved", () => {
    const cases: { file: string; paramKey: string }[] = [
      { file: "layout-sections-module-button-f2-native.json", paramKey: "button" },
      { file: "layout-sections-module-image-f2-native.json", paramKey: HUBSPOT_IMAGE_PARAM_KEY },
      { file: "layout-sections-module-linked-image-f2-native.json", paramKey: HUBSPOT_IMG_PARAM_KEY },
      { file: "layout-sections-module-logos-f2-native.json", paramKey: HUBSPOT_LOGOS_PARAM_KEY },
      { file: "layout-sections-module-gallery-f2-native.json", paramKey: HUBSPOT_GALLERY_PARAM_KEY },
      { file: "layout-sections-module-articles-f2-native.json", paramKey: "custom_posts" },
    ];

    for (const { file, paramKey } of cases) {
      const fixture = loadFixture(file);
      const expectedParams = findFixtureModuleParams(fixture);
      const upm = extractFixture(file, "page", `f2-${paramKey}`);
      const layoutRegion = expectLayoutSectionsRegion(upm);
      const modules: HubspotSourceNode[] = [];
      const visit = (nodes: HubspotSourceNode[]): void => {
        for (const node of nodes) {
          if (node.nodeKind === "module") modules.push(node);
          visit(node.children);
        }
      };
      visit(layoutRegion.nodes);

      expect(modules.length).toBe(1);
      const payload = modules[0]!.payload as Record<string, unknown>;
      expect(isHubspotModuleLike(payload)).toBe(true);
      const nestedParams = readModuleParams(payload);
      expect(nestedParams).toBeDefined();
      expect(nestedParams![paramKey]).toEqual(expectedParams[paramKey]);
      expect(modules[0]!.sourcePath.length).toBeGreaterThan(0);
    }
  });
});
