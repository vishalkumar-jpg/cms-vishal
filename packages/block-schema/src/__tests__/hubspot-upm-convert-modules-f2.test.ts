import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { blockPropSchemas } from "../block-props";
import { migrate, repairLayout } from "../index";
import {
  convertHubspotUpmToLayout,
  extractHubspotUniversalPage,
  MODULE_CONVERTED_NATIVE,
  NATIVE_GALLERY,
  NATIVE_IMAGE,
  NATIVE_LOGO_CAROUSEL,
  tryConvertHubspotModuleNode,
  type HubspotSourceNode,
} from "../hubspot-upm";
import { stableNodeIdFromPath } from "../hubspot-upm/json-utils";
import {
  HUBSPOT_CAROUSEL_PARAM_KEY,
  HUBSPOT_GALLERY_PARAM_KEY,
  HUBSPOT_IMAGE_PARAM_KEY,
  HUBSPOT_IMG_PARAM_KEY,
  HUBSPOT_LOGOS_PARAM_KEY,
} from "../hubspot-upm/complex-module-param-keys";
import { HUBSPOT_IMAGE_GALLERY_PATH_SUFFIX } from "../hubspot-upm/converters/gallery-to-gallery";
import { HUBSPOT_LINKED_IMAGE_PATH } from "../hubspot-upm/converters/linked-image-to-image";
import { readStrictHubspotImageObject } from "../hubspot-upm/converters/hubspot-image-object";
import { hubspotModulePathEndsWith } from "../hubspot-upm/converters/hubspot-pike-module-metadata";
import { HUBSPOT_LOGO_TOUTER_PATH_SUFFIX } from "../hubspot-upm/converters/logos-to-logo-carousel";
import { HUBSPOT_PIKE_IMAGE_PATH_SUFFIX } from "../hubspot-upm/converters/pike-image-to-image";

const AUTOPLAY_INTERVAL_SECONDS = 4;
const MILLISECONDS_PER_SECOND = 1_000;
const UNSUPPORTED_ANIMATION_DELAY_VALUE = 1;
import {
  GALLERY_BLOCK,
  GROUP_BLOCK,
  IMAGE_BLOCK,
  LOGO_CAROUSEL_BLOCK,
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

const expectSchemaValid = (layout: ReturnType<typeof convertHubspotUpmToLayout>["layout"]) => {
  const repaired = migrate(repairLayout(layout));
  for (const node of Object.values(repaired.nodes)) {
    const schema = blockPropSchemas[node.type.resolvedName];
    expect(schema?.safeParse(node.props).success).toBe(true);
  }
};

const minimalPikeImageParams = {
  path: `pike-child-office-beacon/${HUBSPOT_PIKE_IMAGE_PATH_SUFFIX}`,
  css_class: "dnd-module",
  module_id: 1,
  schema_version: 2,
  link_enabled: false,
  link: { href: "", type: "EXTERNAL" },
  picture: false,
  mobile: { image: { size_type: "auto", src: "" } },
  [HUBSPOT_IMAGE_PARAM_KEY]: {
    src: "https://cdn.example.com/hero.png",
    alt: "Hero",
    width: 606,
    height: 341,
    loading: "eager",
  },
};

const minimalLinkedImageParams = {
  path: HUBSPOT_LINKED_IMAGE_PATH,
  css_class: "dnd-module",
  module_id: 1,
  schema_version: 2,
  link: "",
  target: false,
  [HUBSPOT_IMG_PARAM_KEY]: {
    src: "https://cdn.example.com/banner.png",
    alt: "Banner",
    width: 200,
    height: 200,
  },
};

const minimalGalleryParams = {
  path: `/pikev4/${HUBSPOT_IMAGE_GALLERY_PATH_SUFFIX}`,
  css_class: "dnd-module",
  module_id: 1,
  schema_version: 2,
  data_source: "module",
  skin: "grid",
  [HUBSPOT_GALLERY_PARAM_KEY]: [
    { caption: "", image: { src: "https://cdn.example.com/a.png" } },
    { caption: "Seal B", image: { src: "https://cdn.example.com/b.png" } },
  ],
};

const minimalLogoParams = {
  path: `pike-child-office-beacon/${HUBSPOT_LOGO_TOUTER_PATH_SUFFIX}`,
  css_class: "dnd-module",
  module_id: 1,
  schema_version: 2,
  [HUBSPOT_LOGOS_PARAM_KEY]: [
    { image: { src: "https://cdn.example.com/logo-a.png", alt: "Logo A" } },
    { image: { src: "https://cdn.example.com/logo-b.png" } },
  ],
  [HUBSPOT_CAROUSEL_PARAM_KEY]: {
    autoplay: true,
    arrows: false,
    autoplay_interval: AUTOPLAY_INTERVAL_SECONDS,
  },
};

describe("Phase F2 — Pike image → Image", () => {
  it("converts minimal Pike image params", () => {
    const moduleNode = syntheticModule("/layoutSections/m/rows/0/0", minimalPikeImageParams);
    const result = tryConvertHubspotModuleNode(moduleNode, "parent-col");
    expect(result?.blocks).toHaveLength(1);
    const block = result!.blocks[0]!;
    expect(block.node.type.resolvedName).toBe(IMAGE_BLOCK);
    expect(block.node.props).toEqual({
      imageUrl: "https://cdn.example.com/hero.png",
      altText: "Hero",
      width: 606,
      height: 341,
      loading: "eager",
    });
    expect(
      (block.node.custom?.hubspot as { conversionRole?: string })?.conversionRole,
    ).toBe(NATIVE_IMAGE);
    expect(block.nodeId).toBe(stableNodeIdFromPath(`${moduleNode.sourcePath}/native/image`));
  });

  it("harvested Pike image fixture defers due to extra image metadata", () => {
    const moduleNode = findFirstModule(
      extractFixture("layout-sections-module-image-f2-native.json", "f2-image"),
    );
    expect(tryConvertHubspotModuleNode(moduleNode, "parent")).toBeNull();
  });

  it.each([
    ["extra top-level", { ...minimalPikeImageParams, extra: "x" }],
    ["picture enabled", { ...minimalPikeImageParams, picture: true }],
    ["mobile override src", { ...minimalPikeImageParams, mobile: { image: { src: "https://x.com/y.png" } } }],
    ["extra image field", { ...minimalPikeImageParams, [HUBSPOT_IMAGE_PARAM_KEY]: { ...minimalPikeImageParams[HUBSPOT_IMAGE_PARAM_KEY], size_type: "auto" } }],
    ["link enabled without href", { ...minimalPikeImageParams, link_enabled: true, link: { href: "", type: "EXTERNAL" } }],
    [
      "non-empty animation",
      { ...minimalPikeImageParams, animation: { delay: UNSUPPORTED_ANIMATION_DELAY_VALUE } },
    ],
    ["non-empty styles", { ...minimalPikeImageParams, styles: { layout: { spacing: {} } } }],
  ] as const)("defers for Pike image: %s", (_label, params) => {
    expect(tryConvertHubspotModuleNode(syntheticModule("/m", params), "parent")).toBeNull();
  });
});

describe("Phase F2 — linked_image → Image", () => {
  it("converts minimal linked_image params", () => {
    const moduleNode = syntheticModule("/layoutSections/m/rows/0/0", minimalLinkedImageParams);
    const result = tryConvertHubspotModuleNode(moduleNode, "parent-col");
    expect(result?.blocks[0]?.node.type.resolvedName).toBe(IMAGE_BLOCK);
    expect(result?.blocks[0]?.node.props).toEqual({
      imageUrl: "https://cdn.example.com/banner.png",
      altText: "Banner",
      width: 200,
      height: 200,
    });
    expect(
      (result?.blocks[0]?.node.custom?.hubspot as { conversionRole?: string })?.conversionRole,
    ).toBe(NATIVE_IMAGE);
  });

  it("harvested linked_image fixture defers due to unsupported img.loading", () => {
    const moduleNode = findFirstModule(
      extractFixture("layout-sections-module-linked-image-f2-native.json", "f2-linked"),
    );
    expect(tryConvertHubspotModuleNode(moduleNode, "parent")).toBeNull();
  });

  it("defers when img includes size_type", () => {
    const params = {
      ...minimalLinkedImageParams,
      [HUBSPOT_IMG_PARAM_KEY]: {
        ...minimalLinkedImageParams[HUBSPOT_IMG_PARAM_KEY],
        size_type: "auto",
      },
    };
    expect(tryConvertHubspotModuleNode(syntheticModule("/m", params), "parent")).toBeNull();
  });

  it("defers when target is true", () => {
    expect(
      tryConvertHubspotModuleNode(
        syntheticModule("/m", { ...minimalLinkedImageParams, target: true, link: "https://example.com" }),
        "parent",
      ),
    ).toBeNull();
  });

  it.each([
    [
      "non-empty animation",
      { ...minimalLinkedImageParams, animation: { delay: UNSUPPORTED_ANIMATION_DELAY_VALUE } },
    ],
    ["non-empty styles", { ...minimalLinkedImageParams, styles: { layout: {} } }],
  ] as const)("defers for linked_image: %s", (_label, params) => {
    expect(tryConvertHubspotModuleNode(syntheticModule("/m", params), "parent")).toBeNull();
  });
});

describe("Phase F2 — image gallery → Gallery", () => {
  it("converts minimal gallery params", () => {
    const moduleNode = syntheticModule("/layoutSections/m/rows/0/0", minimalGalleryParams);
    const result = tryConvertHubspotModuleNode(moduleNode, "parent-col");
    expect(result?.blocks[0]?.node.type.resolvedName).toBe(GALLERY_BLOCK);
    expect(result?.blocks[0]?.node.props.images).toEqual([
      { imageUrl: "https://cdn.example.com/a.png" },
      { imageUrl: "https://cdn.example.com/b.png", caption: "Seal B" },
    ]);
    expect(
      (result?.blocks[0]?.node.custom?.hubspot as { conversionRole?: string })?.conversionRole,
    ).toBe(NATIVE_GALLERY);
    const expectedNodeId = stableNodeIdFromPath(`${moduleNode.sourcePath}/native/gallery`);
    expect(expectedNodeId).toBe("hsn_332383bb8e9e25c9");
    expect(result?.blocks[0]?.nodeId).toBe(expectedNodeId);
  });

  it("preserves lightbox false on native Gallery props", () => {
    const params = { ...minimalGalleryParams, lightbox: false };
    const result = tryConvertHubspotModuleNode(syntheticModule("/m", params), "parent");
    expect(result?.blocks[0]?.node.props).toEqual({
      images: [
        { imageUrl: "https://cdn.example.com/a.png" },
        { imageUrl: "https://cdn.example.com/b.png", caption: "Seal B" },
      ],
      lightbox: false,
    });
  });

  it("harvested gallery fixture defers because items include image.alt", () => {
    expect(
      tryConvertHubspotModuleNode(
        findFirstModule(extractFixture("layout-sections-module-gallery-f2-native.json", "f2-gallery")),
        "parent",
      ),
    ).toBeNull();
  });

  it.each([
    ["empty gallery", { ...minimalGalleryParams, [HUBSPOT_GALLERY_PARAM_KEY]: [] }],
    ["item alt on image", { ...minimalGalleryParams, [HUBSPOT_GALLERY_PARAM_KEY]: [{ image: { src: "https://a.png", alt: "x" } }] }],
    ["extra item field", { ...minimalGalleryParams, [HUBSPOT_GALLERY_PARAM_KEY]: [{ image: { src: "https://a.png" }, badge: "x" }] }],
    ["wrong path", { ...minimalGalleryParams, path: "/other/gallery" }],
  ] as const)("defers for gallery: %s", (_label, params) => {
    expect(tryConvertHubspotModuleNode(syntheticModule("/m", params), "parent")).toBeNull();
  });
});

describe("Phase F2 — logo-touter → Logo Carousel", () => {
  it("converts minimal logo-touter params", () => {
    const moduleNode = syntheticModule("/layoutSections/m/rows/0/0", minimalLogoParams);
    const result = tryConvertHubspotModuleNode(moduleNode, "parent-col");
    expect(result?.blocks[0]?.node.type.resolvedName).toBe(LOGO_CAROUSEL_BLOCK);
    expect(result?.blocks[0]?.node.props).toEqual({
      logos: [
        { url: "https://cdn.example.com/logo-a.png", alt: "Logo A" },
        { url: "https://cdn.example.com/logo-b.png" },
      ],
      carousel: true,
      autoplay: true,
      autoplayInterval: AUTOPLAY_INTERVAL_SECONDS * MILLISECONDS_PER_SECOND,
    });
    expect(
      (result?.blocks[0]?.node.custom?.hubspot as { conversionRole?: string })?.conversionRole,
    ).toBe(NATIVE_LOGO_CAROUSEL);
    const expectedNodeId = stableNodeIdFromPath(`${moduleNode.sourcePath}/native/logo_carousel`);
    expect(expectedNodeId).toBe("hsn_da188eeef0f01ba0");
    expect(result?.blocks[0]?.nodeId).toBe(expectedNodeId);
  });

  it("harvested logos fixture defers due to carousel.dots and item max_width", () => {
    expect(
      tryConvertHubspotModuleNode(
        findFirstModule(extractFixture("layout-sections-module-logos-f2-native.json", "f2-logos")),
        "parent",
      ),
    ).toBeNull();
  });

  it.each([
    ["empty logos", { ...minimalLogoParams, [HUBSPOT_LOGOS_PARAM_KEY]: [] }],
    ["carousel dots", { ...minimalLogoParams, [HUBSPOT_CAROUSEL_PARAM_KEY]: { dots: true } }],
    ["logo max_width", { ...minimalLogoParams, [HUBSPOT_LOGOS_PARAM_KEY]: [{ image: { src: "https://a.png" }, max_width: 100 }] }],
    ["resize_target", { ...minimalLogoParams, resize_target: 225 }],
    ["skin", { ...minimalLogoParams, skin: "grid" }],
    [
      "autoplay_interval zero",
      {
        ...minimalLogoParams,
        [HUBSPOT_CAROUSEL_PARAM_KEY]: { autoplay: true, autoplay_interval: 0 },
      },
    ],
    [
      "autoplay_interval negative",
      {
        ...minimalLogoParams,
        [HUBSPOT_CAROUSEL_PARAM_KEY]: { autoplay: true, autoplay_interval: -1 },
      },
    ],
  ] as const)("defers for logos: %s", (_label, params) => {
    expect(tryConvertHubspotModuleNode(syntheticModule("/m", params), "parent")).toBeNull();
  });
});

describe("Phase F2 — hubspot image object validation", () => {
  const baseImage = { src: "https://cdn.example.com/x.png" };

  it.each([
    [
      "width zero",
      { ...baseImage, width: 0, height: 0 },
      { imageUrl: "https://cdn.example.com/x.png", width: 0, height: 0 },
    ],
    ["omitted dimensions", baseImage, { imageUrl: "https://cdn.example.com/x.png" }],
  ] as const)("accepts %s", (_label, value, expected) => {
    expect(readStrictHubspotImageObject(value)).toEqual(expected);
  });

  it.each([
    ["width -1", { ...baseImage, width: -1 }],
    ["height -1", { ...baseImage, height: -1 }],
    ['width "100"', { ...baseImage, width: "100" }],
    ['height "100"', { ...baseImage, height: "100" }],
  ] as const)("rejects %s", (_label, value) => {
    expect(readStrictHubspotImageObject(value)).toBeNull();
  });
});

describe("Phase F2 — Pike module path matching", () => {
  it.each([
    ["/modules/image", "modules/image", true],
    ["modules/image", "modules/image", true],
    ["/foo/modules/image", "modules/image", true],
    ["custommodules/image", "modules/image", false],
    ["/custommodules/image", "modules/image", false],
  ] as const)("hubspotModulePathEndsWith(%s, %s) -> %s", (path, suffix, expected) => {
    expect(hubspotModulePathEndsWith(path, suffix)).toBe(expected);
  });

  it("returns false for non-string path", () => {
    expect(hubspotModulePathEndsWith(1, "modules/image")).toBe(false);
  });
});

describe("Phase F2 — deferred families remain deferred", () => {
  it("button fixture defers", () => {
    const upm = extractFixture("layout-sections-module-button-f2-native.json", "f2-button");
    const moduleNode = findFirstModule(upm);
    expect(tryConvertHubspotModuleNode(moduleNode, "parent")).toBeNull();
    const { deferredModules, layout } = convertHubspotUpmToLayout(upm);
    expect(deferredModules.length).toBe(1);
    expect(Object.values(layout.nodes).some((n) => n.type.resolvedName === GROUP_BLOCK)).toBe(true);
  });

  it("featured-posts fixture defers", () => {
    const upm = extractFixture("layout-sections-module-articles-f2-native.json", "f2-articles");
    expect(tryConvertHubspotModuleNode(findFirstModule(upm), "parent")).toBeNull();
    expect(convertHubspotUpmToLayout(upm).deferredModules.length).toBe(1);
  });
});

describe("Phase F2 — layout integration", () => {
  it("minimal Pike image layout passes schema, migrate, and repair", () => {
    const upm = extractHubspotUniversalPage({
      raw: {
        layoutSections: {
          "dnd_area-main": {
            rows: [{ "0": { type: "cell", width: 12, rows: [{ "0": { type: "custom_widget", params: minimalPikeImageParams } }] } }],
          },
        },
      },
      kind: "page",
      hsId: "f2-layout-image",
      extractedAtIso: EXTRACTED_AT,
    });
    const moduleNode = findFirstModule(upm);
    const payloadBefore = JSON.stringify(moduleNode.payload);
    const { layout, deferredModules, diagnostics } = convertHubspotUpmToLayout(upm);
    expect(deferredModules.length).toBe(0);
    expect(diagnostics.some((d) => d.code === MODULE_CONVERTED_NATIVE)).toBe(true);
    expectSchemaValid(layout);
    expect(JSON.stringify(moduleNode.payload)).toBe(payloadBefore);
  });
});
