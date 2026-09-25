import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  hubspotAssetIdentityKey,
  isLikelyHubspotMediaUrl,
  normalizeHubspotAssetUrl,
} from "../hubspot-upm/asset-identity";
import { discoverHubspotMediaAssetsFromPage } from "../hubspot-upm/asset-discovery";
import {
  rewriteAssetUrlsInHtml,
  rewriteAssetUrlsInSerializedLayout,
  rewriteSrcsetAttributeValue,
} from "../hubspot-upm/rewrite-asset-references";
import { buildHubspotAssetMigrationUrlMap } from "../hubspot-upm/asset-migration-url-map";
import { HUBSPOT_UNIVERSAL_PAGE_MODEL_VERSION } from "../hubspot-upm/types";
import { extractHubspotUniversalPage } from "../hubspot-upm/extract";
import { collectHttpUrlsFromJson, extractHttpUrlsFromSrcset } from "../hubspot-upm/json-utils";
import { HUBSPOT_ASSET_MIGRATION_DIAGNOSTIC_CODES } from "../hubspot-upm/asset-migration-diagnostics";
import { hubspotScopedImportFromSource } from "../hubspot-upm/import-normalized";
import { emptyLayout } from "../layout";

describe("HubSpot asset identity", () => {
  test("normalizes query strings for deduplication", () => {
    expect(normalizeHubspotAssetUrl("https://cdn.example.com/a.png?w=100")).toBe(
      "https://cdn.example.com/a.png",
    );
  });

  test("identity key is stable for hubfs URLs with different query params", () => {
    const a = hubspotAssetIdentityKey("https://x.com/hubfs/123/logo.png?v=1");
    const b = hubspotAssetIdentityKey("https://x.com/hubfs/123/logo.png?v=2");
    expect(a).toBe(b);
  });

  test("hubfs identity uses full nested path after portal id", () => {
    const a = hubspotAssetIdentityKey("https://x.com/hubfs/123/images/a.png");
    const b = hubspotAssetIdentityKey("https://x.com/hubfs/123/images/b.png");
    expect(a).toBe("hubspot:hubfs:123/images/a.png");
    expect(b).toBe("hubspot:hubfs:123/images/b.png");
    expect(a).not.toBe(b);
  });

  test("fileId query takes precedence over hubfs path", () => {
    expect(
      hubspotAssetIdentityKey("https://x.com/hubfs/123/images/a.png?fileId=999"),
    ).toBe("hubspot:fileId:999");
  });

  test("identity key distinguishes responsive width query variants on the same hubfs file", () => {
    const desktop = hubspotAssetIdentityKey("https://x.com/hubfs/123/hero.png?width=1200");
    const mobile = hubspotAssetIdentityKey("https://x.com/hubfs/123/hero.png?width=480");
    expect(desktop).not.toBe(mobile);
    expect(desktop).toContain("width=1200");
    expect(mobile).toContain("width=480");
  });

  test("isLikelyHubspotMediaUrl accepts corpus CDN png paths", () => {
    expect(isLikelyHubspotMediaUrl("https://cdn.example.com/asset.png")).toBe(true);
    expect(isLikelyHubspotMediaUrl("https://example.com/about")).toBe(false);
  });
});

describe("HubSpot responsive asset discovery", () => {
  test("extractHttpUrlsFromSrcset collects each variant URL", () => {
    const urls = extractHttpUrlsFromSrcset(
      "https://cdn.example.com/a.png?width=480 480w, https://cdn.example.com/a.png?width=960 960w",
    );
    expect(urls).toHaveLength(2);
    expect(hubspotAssetIdentityKey(urls[0]!)).not.toBe(hubspotAssetIdentityKey(urls[1]!));
  });

  test("image fixture with empty mobile src does not emit unsupported responsive diagnostic", () => {
    const raw = JSON.parse(
      readFileSync(
        join(import.meta.dir, "fixtures/hubspot/layout-sections-module-image-f2-native.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    const upm = extractHubspotUniversalPage({
      raw,
      kind: "page",
      hsId: "img-j1",
      extractedAtIso: "2026-01-01T00:00:00.000Z",
    });
    expect(
      upm.diagnostics.some(
        (d) => d.code === HUBSPOT_ASSET_MIGRATION_DIAGNOSTIC_CODES.ASSET_RESPONSIVE_VARIANT_UNSUPPORTED,
      ),
    ).toBe(false);
  });
});

describe("HubSpot asset discovery", () => {
  test("collects spaced and unquoted src and href attributes", () => {
    const imageUrl = "https://cdn.example.com/spaced.png";
    const linkUrl = "https://cdn.example.com/unquoted.pdf";
    const out: { url: string; discoveredAtPath: string }[] = [];

    collectHttpUrlsFromJson(
      `<img src = '${imageUrl}'><a href=${linkUrl}>download</a>`,
      "/html",
      new Set(),
      out,
    );

    expect(out).toEqual([
      { url: imageUrl, discoveredAtPath: "/html@src" },
      { url: linkUrl, discoveredAtPath: "/html@href" },
    ]);
  });

  test("collects spaced quoted and unquoted srcset attributes", () => {
    const quotedUrl = "https://cdn.example.com/quoted.png";
    const unquotedUrl = "https://cdn.example.com/unquoted.png";
    const out: { url: string; discoveredAtPath: string }[] = [];

    collectHttpUrlsFromJson(
      `<source srcset = '${quotedUrl} 1x'><img srcset=${unquotedUrl}>`,
      "/html",
      new Set(),
      out,
    );

    expect(out).toEqual([
      { url: quotedUrl, discoveredAtPath: "/html@srcset" },
      { url: unquotedUrl, discoveredAtPath: "/html@srcset" },
    ]);
  });

  test("gallery fixture discovers deduped media assets with identity", () => {
    const raw = JSON.parse(
      readFileSync(
        join(import.meta.dir, "fixtures/hubspot/layout-sections-module-gallery-f2-native.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    const upm = extractHubspotUniversalPage({
      raw,
      kind: "page",
      hsId: "gallery-j1",
      extractedAtIso: "2026-01-01T00:00:00.000Z",
    });
    const assets = discoverHubspotMediaAssetsFromPage(upm);
    expect(assets.length).toBeGreaterThan(0);
    expect(assets.every((a) => a.identityKey && a.normalizedUrl)).toBe(true);
    expect(new Set(assets.map((a) => a.identityKey)).size).toBe(assets.length);
  });
});

describe("HubSpot asset migration url map", () => {
  test("discovers a rich-text image src for scoped-import HTML rewriting", () => {
    const from = "https://cdn2.hubspot.net/hubfs/123/rich-text.png";
    const to = "https://media.ob.example/rich-text.png";
    const html = `<p>Rich text <img src="${from}" alt="example"></p>`;
    const raw = { postBody: html };
    const upm = extractHubspotUniversalPage({
      raw,
      kind: "blog_post",
      hsId: "rich-text-post",
      extractedAtIso: "2026-01-01T00:00:00.000Z",
    });

    const assetUrlMap = buildHubspotAssetMigrationUrlMap(upm, {
      [hubspotAssetIdentityKey(from)]: to,
    });
    const bundle = hubspotScopedImportFromSource(
      raw,
      "blog_post",
      "rich-text-post",
      "2026-01-01T00:00:00.000Z",
      { assetUrlMap },
    );

    expect(upm.assets.some((asset) => asset.url === from)).toBe(true);
    expect(assetUrlMap).toEqual({ [from]: to });
    expect(rewriteAssetUrlsInHtml(html, assetUrlMap)).toContain(`src="${to}"`);
    expect(bundle.normalized.html).toContain(`src="${to}"`);
  });

  test("does not collapse responsive variants onto shared normalizedUrl", () => {
    const baseUrl = "https://cdn2.hubspot.net/hubfs/123/hero.png";
    const responsiveUrl = "https://cdn2.hubspot.net/hubfs/123/hero.png?width=480";
    const normalized = "https://cdn2.hubspot.net/hubfs/123/hero.png";
    const baseAsset = {
      url: baseUrl,
      normalizedUrl: normalized,
      identityKey: hubspotAssetIdentityKey(baseUrl),
      discoveredAtPath: "/img/src",
    };
    const responsiveAsset = {
      url: responsiveUrl,
      normalizedUrl: normalized,
      identityKey: hubspotAssetIdentityKey(responsiveUrl),
      discoveredAtPath: "/img/src@srcset",
      role: "responsive_variant" as const,
    };
    const upm = {
      modelVersion: HUBSPOT_UNIVERSAL_PAGE_MODEL_VERSION,
      assets: [baseAsset, responsiveAsset],
      sourceRecord: { img: { src: baseUrl, mobile: responsiveUrl } },
    } as import("../hubspot-upm/types").HubspotUniversalPage;

    const identityToObUrl = new Map<string, string>([
      [baseAsset.identityKey, "https://media.ob/base.png"],
      [responsiveAsset.identityKey, "https://media.ob/mobile.png"],
    ]);
    const urlMap = buildHubspotAssetMigrationUrlMap(upm, identityToObUrl);
    expect(urlMap[baseUrl]).toBe("https://media.ob/base.png");
    expect(urlMap[responsiveUrl]).toBe("https://media.ob/mobile.png");
    expect(urlMap[normalized]).toBe("https://media.ob/base.png");
  });
});

describe("HubSpot asset URL rewriting", () => {
  test("rewrites spaced and unquoted src and href attributes while preserving syntax", () => {
    const imageFrom = "https://hubspot.example/image.png";
    const imageTo = "https://media.ob/image.png";
    const linkFrom = "https://hubspot.example/file.pdf";
    const linkTo = "https://media.ob/file.pdf";
    const html = `<img src = '${imageFrom}'><a href=${linkFrom}>download</a>`;

    expect(rewriteAssetUrlsInHtml(html, { [imageFrom]: imageTo, [linkFrom]: linkTo })).toBe(
      `<img src = '${imageTo}'><a href=${linkTo}>download</a>`,
    );
  });

  test("rewrites layout props and rich text src attributes", () => {
    const from = "https://cdn.example.com/asset.png";
    const to = "https://media.ob.example/sites/1/photo.png";
    const layout = emptyLayout();
    layout.nodes.ROOT = {
      ...layout.nodes.ROOT!,
      props: { imageUrl: from, nested: { url: from } },
    };
    const rewritten = rewriteAssetUrlsInSerializedLayout(layout, { [from]: to });
    expect((rewritten.nodes.ROOT!.props as Record<string, unknown>).imageUrl).toBe(to);
    const html = `<p><img src="${from}" alt="x"></p>`;
    expect(rewriteAssetUrlsInHtml(html, { [from]: to })).toContain(to);
  });

  test("rewrites srcset candidates while preserving descriptors", () => {
    const a = "https://hubspot/a.jpg";
    const b = "https://hubspot/a@2x.jpg";
    const map = { [a]: "https://media.ob/a.jpg", [b]: "https://media.ob/a@2x.jpg" };
    expect(rewriteSrcsetAttributeValue(`${a} 1x, ${b} 2x`, map)).toBe(
      "https://media.ob/a.jpg 1x, https://media.ob/a@2x.jpg 2x",
    );
    const html = `<img srcset="${a} 480w, ${b} 960w" src="${a}">`;
    const out = rewriteAssetUrlsInHtml(html, map);
    expect(out).toContain("https://media.ob/a.jpg 480w");
    expect(out).toContain("https://media.ob/a@2x.jpg 960w");
    expect(out).toContain('src="https://media.ob/a.jpg"');
  });

  test("rewrites spaced quoted and unquoted srcset attributes while preserving syntax", () => {
    const quotedFrom = "https://hubspot/quoted.jpg";
    const quotedTo = "https://media.ob/quoted.jpg";
    const unquotedFrom = "https://hubspot/unquoted.jpg";
    const unquotedTo = "https://media.ob/unquoted.jpg";
    const html = `<source srcset = '${quotedFrom} 1x'><img srcset=${unquotedFrom}>`;

    expect(
      rewriteAssetUrlsInHtml(html, {
        [quotedFrom]: quotedTo,
        [unquotedFrom]: unquotedTo,
      }),
    ).toBe(`<source srcset = '${quotedTo} 1x'><img srcset=${unquotedTo}>`);
  });

  test("leaves unmapped srcset candidates unchanged", () => {
    const mapped = "https://hubspot/mapped.jpg";
    const unmapped = "https://hubspot/unmapped.jpg";
    const out = rewriteSrcsetAttributeValue(`${mapped} 1x, ${unmapped} 2x`, {
      [mapped]: "https://media.ob/mapped.jpg",
    });
    expect(out).toBe("https://media.ob/mapped.jpg 1x, https://hubspot/unmapped.jpg 2x");
  });

  test("hubspotScopedImportFromSource applies assetUrlMap to layout", () => {
    const raw = JSON.parse(
      readFileSync(
        join(import.meta.dir, "fixtures/hubspot/layout-sections-module-cards-native.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    const to = "https://media.ob.example/migrated.png";
    const fromCards = "https://cdn.example.com/a.png";
    const bundle = hubspotScopedImportFromSource(raw, "page", "3004", "2026-01-01T00:00:00.000Z", {
      assetUrlMap: { [fromCards]: to },
    });
    const layoutJson = JSON.stringify(bundle.layout);
    expect(layoutJson).toContain(to);
    expect(layoutJson).not.toContain(fromCards);
  });
});
