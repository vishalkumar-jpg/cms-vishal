import { describe, expect, test } from "bun:test";
import type { SerializedLayout } from "@ob-cms/block-schema";
import { imageDimensionsFix } from "../fixes/image-dimensions.fix";
import { lazyLoadingFix } from "../fixes/lazy-loading.fix";
import { fontDisplayFix } from "../fixes/font-display.fix";
import { imageOptimizationFix } from "../fixes/image-optimization.fix";
import { applicableFixes, getFix, AUTO_FIXES } from "../registry";
import { fixRuleIds } from "../types";

/** Minimal node/layout builders — the engine only reads type/props/nodes. */
const node = (resolvedName: string, props: Record<string, unknown> = {}, nodes: string[] = []) => ({
  type: { resolvedName },
  props,
  nodes,
  linkedNodes: {},
  parent: null,
});

const makeLayout = (nodes: Record<string, ReturnType<typeof node>>): SerializedLayout =>
  ({ schemaVersion: "2.0", root: "ROOT", nodes }) as unknown as SerializedLayout;

/** Root → [img1, row → [img2, img3]] */
const sample = (): SerializedLayout =>
  makeLayout({
    ROOT: node("Section", {}, ["img1", "row"]),
    img1: node("Image", { imageUrl: "/a.jpg", intrinsicWidth: 800, intrinsicHeight: 600 }),
    row: node("Row", {}, ["img2", "img3"]),
    img2: node("Image", { imageUrl: "/b.jpg", width: 200, intrinsicWidth: 400, intrinsicHeight: 300 }),
    img3: node("Image", { imageUrl: "/c.jpg" }), // no intrinsics
  });

describe("imageDimensionsFix", () => {
  test("backfills width/height from intrinsics only where missing", () => {
    const { changes, layout } = imageDimensionsFix.plan(sample());
    // img1 gains both, img2 gains only height (width already set), img3 skipped.
    expect(layout.nodes.img1.props.width).toBe(800);
    expect(layout.nodes.img1.props.height).toBe(600);
    expect(layout.nodes.img2.props.width).toBe(200); // untouched
    expect(layout.nodes.img2.props.height).toBe(300);
    expect(layout.nodes.img3.props.width).toBeUndefined();
    const fields = changes.map((c) => `${c.nodeId}.${c.field}`).sort();
    expect(fields).toEqual(["img1.height", "img1.width", "img2.height"]);
  });

  test("is a no-op (same layout ref) when nothing to fix", () => {
    const base = makeLayout({ ROOT: node("Section", {}, ["i"]), i: node("Image", { width: 10, height: 10 }) });
    const res = imageDimensionsFix.plan(base);
    expect(res.changes).toHaveLength(0);
    expect(res.layout).toBe(base);
  });

  test("does not mutate the input layout", () => {
    const input = sample();
    imageDimensionsFix.plan(input);
    expect(input.nodes.img1.props.width).toBeUndefined();
  });
});

describe("lazyLoadingFix", () => {
  test('lazy-loads every image except the first in document order', () => {
    const { changes, layout } = lazyLoadingFix.plan(sample());
    expect(layout.nodes.img1.props.loading).toBeUndefined(); // first stays eager
    expect(layout.nodes.img2.props.loading).toBe("lazy");
    expect(layout.nodes.img3.props.loading).toBe("lazy");
    expect(changes.map((c) => c.nodeId).sort()).toEqual(["img2", "img3"]);
  });

  test("skips images already lazy (idempotent)", () => {
    const l = makeLayout({
      ROOT: node("Section", {}, ["a", "b"]),
      a: node("Image", {}),
      b: node("Image", { loading: "lazy" }),
    });
    const res = lazyLoadingFix.plan(l);
    expect(res.changes).toHaveLength(0);
    expect(res.layout).toBe(l);
  });
});

describe("fontDisplayFix", () => {
  test("is manual and never edits the draft", () => {
    expect(fontDisplayFix.category).toBe("manual");
    const input = sample();
    const res = fontDisplayFix.plan(input);
    expect(res.changes).toHaveLength(0);
    expect(res.layout).toBe(input);
  });
});

describe("imageOptimizationFix", () => {
  /** Root → [remote raster (no variants), remote svg, data uri, already-optimized] */
  const media = (): SerializedLayout =>
    makeLayout({
      ROOT: node("Section", {}, ["a", "b", "c", "d", "e"]),
      a: node("Image", { imageUrl: "https://cdn.test/photo.jpg" }), // candidate
      b: node("Image", { imageUrl: "https://cdn.test/logo.svg" }), // svg → skip
      c: node("Image", { imageUrl: "data:image/png;base64,AAAA" }), // data uri → skip
      d: node("Image", { imageUrl: "https://cdn.test/hero.png", variants: [{ width: 640, format: "webp", url: "x", bytes: 1 }] }), // already optimized → skip
      e: node("Image", { imageUrl: "/local/rel.jpg" }), // relative → skip (not resolvable media url)
    });

  test("is a one-click media-optimize fix", () => {
    expect(imageOptimizationFix.category).toBe("one_click");
    expect(imageOptimizationFix.effect).toBe("media-optimize");
  });

  test("plans only unoptimized remote raster images and never edits the layout", () => {
    const input = media();
    const { changes, layout } = imageOptimizationFix.plan(input);
    expect(changes.map((c) => c.nodeId)).toEqual(["a"]);
    expect(changes[0]?.after).toBe("https://cdn.test/photo.jpg");
    expect(layout).toBe(input); // media-optimize never mutates the draft
  });

  test("dedupes repeated image urls", () => {
    const l = makeLayout({
      ROOT: node("Section", {}, ["a", "b"]),
      a: node("Image", { imageUrl: "https://cdn.test/same.jpg" }),
      b: node("Image", { imageUrl: "https://cdn.test/same.jpg" }),
    });
    expect(imageOptimizationFix.plan(l).changes).toHaveLength(1);
  });
});

describe("registry", () => {
  test("getFix resolves by ruleId", () => {
    expect(getFix("unsized-images")).toBe(imageDimensionsFix);
    expect(getFix("offscreen-images")).toBe(lazyLoadingFix);
    expect(getFix("nope")).toBeNull();
  });

  test("getFix resolves a fix by any of its rule ids", () => {
    expect(getFix("uses-optimized-images")).toBe(imageOptimizationFix);
    expect(getFix("modern-image-formats")).toBe(imageOptimizationFix);
  });

  test("applicableFixes filters to flagged recommendation ids", () => {
    const fixes = applicableFixes(["unsized-images", "font-display", "unknown-audit"]);
    expect(fixes.map((f) => f.ruleId).sort()).toEqual(["font-display", "unsized-images"]);
  });

  test("applicableFixes matches a multi-rule fix once via a secondary rule id", () => {
    const fixes = applicableFixes(["modern-image-formats"]);
    expect(fixes).toHaveLength(1);
    expect(fixes[0]).toBe(imageOptimizationFix);
  });

  test("every registered rule id maps to exactly one fix", () => {
    const ids = AUTO_FIXES.flatMap(fixRuleIds);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
