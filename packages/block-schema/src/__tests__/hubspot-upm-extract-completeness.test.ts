import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  normalizeHubspotContent,
  resolveTopLevelBodyHtml,
  type HubspotRawContent,
} from "../hubspot-api";
import {
  deriveLegacyImportHtml,
  extractHubspotUniversalPage,
  hubspotImportNormalizedFromSource,
} from "../hubspot-upm";
import type { HubspotContentRegion, HubspotUniversalPage } from "../hubspot-upm/types";

const FIXTURES_DIR = join(import.meta.dir, "fixtures/hubspot");
const EXTRACTED_AT = "2026-01-01T00:00:00.000Z";
const PAGE_KIND = "page" as const;

const loadFixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(FIXTURES_DIR, name), "utf8")) as Record<string, unknown>;

const expectLayoutSectionsRegion = (upm: HubspotUniversalPage): HubspotContentRegion => {
  const layoutRegion = upm.regions.find((r) => r.kind === "layout_sections");
  expect(layoutRegion).toBeDefined();
  if (!layoutRegion) {
    throw new Error("expected layout_sections region from extraction");
  }
  return layoutRegion;
};

const parityWithNormalize = (raw: HubspotRawContent): void => {
  const fromUpm = hubspotImportNormalizedFromSource(raw, PAGE_KIND, String(raw.id ?? "x"), EXTRACTED_AT);
  expect(fromUpm).toEqual(normalizeHubspotContent(raw));
  const upm = extractHubspotUniversalPage({
    raw: raw as Record<string, unknown>,
    kind: PAGE_KIND,
    hsId: String(raw.id ?? "x"),
    extractedAtIso: EXTRACTED_AT,
  });
  expect(deriveLegacyImportHtml(upm.legacyHtmlParts)).toBe(normalizeHubspotContent(raw).html);
};

describe("hubspot UPM extraction completeness", () => {
  test("resolveTopLevelBodyHtml reads string and object body shapes", () => {
    expect(resolveTopLevelBodyHtml({ body: "<p>x</p>" })).toBe("<p>x</p>");
    expect(resolveTopLevelBodyHtml({ body: { html: "<p>obj</p>" } })).toBe("<p>obj</p>");
    expect(resolveTopLevelBodyHtml({ body: { html: "   " } })).toBeUndefined();
    expect(
      resolveTopLevelBodyHtml({ body: [] as unknown as HubspotRawContent["body"] }),
    ).toBeUndefined();
  });

  test("body-object fixture produces html_body region and legacy parity", () => {
    const raw = loadFixture("body-object-page.json") as HubspotRawContent;
    parityWithNormalize(raw);
    const upm = extractHubspotUniversalPage({
      raw: raw as Record<string, unknown>,
      kind: PAGE_KIND,
      hsId: "6001",
      extractedAtIso: EXTRACTED_AT,
    });
    const htmlRegion = upm.regions.find((r) => r.kind === "html_body");
    expect(htmlRegion?.nodes.some((n) => n.sourcePath === "/body")).toBe(true);
    expect(htmlRegion?.nodes[0]?.htmlFragments[0]?.value).toContain("From object body");
  });

  test("combined fixture exposes html_body, layout_sections, and widget_containers", () => {
    const raw = loadFixture("combined-content-page.json") as HubspotRawContent;
    parityWithNormalize(raw);
    const upm = extractHubspotUniversalPage({
      raw: raw as Record<string, unknown>,
      kind: PAGE_KIND,
      hsId: "6002",
      extractedAtIso: EXTRACTED_AT,
    });
    expect(upm.regions.map((r) => r.kind).sort()).toEqual(
      ["html_body", "layout_sections", "widget_containers"].sort(),
    );
    expect(normalizeHubspotContent(raw).html).toBe("<h1>Top HTML</h1>");
  });

  test("multi-section layout preserves both section paths and nested module", () => {
    const raw = loadFixture("multi-section-layout.json") as HubspotRawContent;
    parityWithNormalize(raw);
    const upm = extractHubspotUniversalPage({
      raw: raw as Record<string, unknown>,
      kind: PAGE_KIND,
      hsId: "6003",
      extractedAtIso: EXTRACTED_AT,
    });
    const layoutRegion = expectLayoutSectionsRegion(upm);
    expect(layoutRegion.nodes.map((n) => n.sourcePath).sort()).toEqual(
      ["/layoutSections/dnd_area-footer", "/layoutSections/dnd_area-main"].sort(),
    );
    const moduleIds: string[] = [];
    const visit = (nodes: typeof layoutRegion.nodes): void => {
      for (const node of nodes) {
        if (node.nodeKind === "module" && node.hubspot?.moduleId) {
          moduleIds.push(node.hubspot.moduleId);
        }
        visit(node.children);
      }
    };
    visit(layoutRegion.nodes);
    expect(moduleIds).toContain("footer_cta");
  });

  test("empty layoutSections emits LAYOUT_SECTIONS_EMPTY diagnostic", () => {
    const upm = extractHubspotUniversalPage({
      raw: { layoutSections: {} },
      kind: PAGE_KIND,
      hsId: "empty-layout",
      extractedAtIso: EXTRACTED_AT,
    });
    expect(upm.regions.some((r) => r.kind === "layout_sections")).toBe(false);
    expect(upm.diagnostics.some((d) => d.code === "LAYOUT_SECTIONS_EMPTY")).toBe(true);
    expect(upm.sourceRecord).toEqual({ layoutSections: {} });
  });

  test("invalid widgetContainers emits INVALID_WIDGET_CONTAINERS diagnostic", () => {
    const upm = extractHubspotUniversalPage({
      raw: { widgetContainers: [] },
      kind: PAGE_KIND,
      hsId: "bad-widgets",
      extractedAtIso: EXTRACTED_AT,
    });
    expect(upm.regions.some((r) => r.kind === "widget_containers")).toBe(false);
    expect(upm.diagnostics.some((d) => d.code === "INVALID_WIDGET_CONTAINERS")).toBe(true);
  });

  test("categoryId remains on sourceRecord without metadata field", () => {
    const upm = extractHubspotUniversalPage({
      raw: { categoryId: 42, name: "Blog" },
      kind: "blog_post",
      hsId: "cat",
      extractedAtIso: EXTRACTED_AT,
    });
    expect((upm.sourceRecord as Record<string, unknown>).categoryId).toBe(42);
    expect(upm.metadata).not.toHaveProperty("categoryId");
    expect(upm.diagnostics.some((d) => d.code === "UNMAPPED_TOP_LEVEL_FIELD")).toBe(false);
  });

  test("slug metadata covers absent, empty, valid, and unparseable values", () => {
    const absent = extractHubspotUniversalPage({
      raw: { name: "No slug" },
      kind: PAGE_KIND,
      hsId: "s1",
      extractedAtIso: EXTRACTED_AT,
    });
    expect(absent.metadata.slug.status).toBe("absent");

    const empty = extractHubspotUniversalPage({
      raw: { slug: "   " },
      kind: PAGE_KIND,
      hsId: "s2",
      extractedAtIso: EXTRACTED_AT,
    });
    expect(empty.metadata.slug.status).toBe("absent");

    const valid = extractHubspotUniversalPage({
      raw: { slug: "about" },
      kind: PAGE_KIND,
      hsId: "s3",
      extractedAtIso: EXTRACTED_AT,
    });
    expect(valid.metadata.slug).toEqual({
      status: "present",
      source: "about",
      normalized: "about",
    });

    const bad = extractHubspotUniversalPage({
      raw: { slug: 123 },
      kind: PAGE_KIND,
      hsId: "s4",
      extractedAtIso: EXTRACTED_AT,
    });
    expect(bad.metadata.slug.status).toBe("unparseable");
  });
});
