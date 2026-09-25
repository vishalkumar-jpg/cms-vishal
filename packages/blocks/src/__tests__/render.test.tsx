import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { importPocExport } from "@ob-cms/block-schema";
import { RenderLayout, blockRegistry, REGISTERED_BLOCK_TYPES } from "../index";

const EXPORT_PATH = resolve(
  import.meta.dir,
  "../../../../../team-docs/reference-assets/officebeacon-homepage.poc-export.json",
);
const loadLayout = () =>
  importPocExport(JSON.parse(readFileSync(EXPORT_PATH, "utf8"))).layout;

describe("blockRegistry", () => {
  it("registers all block types including extended marketing/media blocks", () => {
    expect(REGISTERED_BLOCK_TYPES.length).toBe(68);
  });

  it("resolves the Search block (public on-site search island)", () => {
    expect(REGISTERED_BLOCK_TYPES).toContain("Search");
    expect(blockRegistry.Search).toBeDefined();
    expect(blockRegistry.Search.isCanvas).toBe(false);
    expect(blockRegistry.Search.defaultProps.placeholder).toBe("Search…");
  });

  it("resolves the Repeater block as a canvas (dynamic)", () => {
    expect(REGISTERED_BLOCK_TYPES).toContain("Repeater");
    expect(blockRegistry.Repeater).toBeDefined();
    expect(blockRegistry.Repeater.isCanvas).toBe(true);
  });

  it("resolves the Icon block (rich-media)", () => {
    expect(REGISTERED_BLOCK_TYPES).toContain("Icon");
    expect(blockRegistry.Icon).toBeDefined();
    expect(blockRegistry.Icon.isCanvas).toBe(false);
    expect(blockRegistry.Icon.defaultProps.name).toBe("Sparkles");
  });

  it("resolves the Video block (rich-media)", () => {
    expect(REGISTERED_BLOCK_TYPES).toContain("Video");
    expect(blockRegistry.Video).toBeDefined();
    expect(blockRegistry.Video.isCanvas).toBe(false);
    expect(blockRegistry.Video.defaultProps.provider).toBe("auto");
  });

  it("resolves the Embed block (not an unknown block)", () => {
    expect(REGISTERED_BLOCK_TYPES).toContain("Embed");
    expect(blockRegistry.Embed).toBeDefined();
    expect(blockRegistry.Embed.isCanvas).toBe(false);
    expect(blockRegistry.Embed.defaultProps.html).toBe("");
  });

  it("resolves the Reusable Block (not an unknown block)", () => {
    expect(REGISTERED_BLOCK_TYPES).toContain("Reusable Block");
    expect(blockRegistry["Reusable Block"]).toBeDefined();
    expect(blockRegistry["Reusable Block"].isCanvas).toBe(false);
  });

  it("resolves the Collection List block (not an unknown block)", () => {
    expect(REGISTERED_BLOCK_TYPES).toContain("Collection List");
    expect(blockRegistry["Collection List"]).toBeDefined();
    expect(blockRegistry["Collection List"].isCanvas).toBe(false);
  });

  it("resolves the Form block (not an unknown block)", () => {
    expect(REGISTERED_BLOCK_TYPES).toContain("Form");
    expect(blockRegistry.Form).toBeDefined();
    expect(blockRegistry.Form.isCanvas).toBe(false);
    expect(blockRegistry.Form.defaultProps.submitLabel).toBe("Submit");
  });
});

describe("RenderLayout SSR smoke", () => {
  it("renders the OB homepage layout to static HTML without throwing", () => {
    const layout = loadLayout();
    const html = renderToStaticMarkup(
      React.createElement(RenderLayout, { data: layout, blocks: blockRegistry }),
    );
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(1000);
  });

  it("resolves every node type in the OB export to a real component", () => {
    const layout = loadLayout();
    const used = new Set(
      Object.values(layout.nodes).map((n) => n.type.resolvedName),
    );
    for (const type of used) {
      expect(blockRegistry[type]).toBeDefined();
      // Components are now `forwardRef` exotic components (objects with a
      // `.render` function) so the Craft builder can attach connectors to each
      // block's real root DOM node. Accept either a plain function component or
      // a forwardRef object — both are renderable.
      const comp = blockRegistry[type].component as
        | ((...args: unknown[]) => unknown)
        | { render?: unknown; $$typeof?: unknown };
      const renderable =
        typeof comp === "function" ||
        (typeof comp === "object" && comp !== null && typeof (comp as { render?: unknown }).render === "function");
      expect(renderable).toBe(true);
    }
    expect(used.size).toBe(28);
  });

  it("renders content from the OB export (hero text appears)", () => {
    const layout = loadLayout();
    const html = renderToStaticMarkup(
      React.createElement(RenderLayout, { data: layout }),
    );
    // The hero highlight phrase from the OB homepage seed.
    expect(html).toContain("Remote Teams");
  });
});

describe("rich-media blocks SSR", () => {
  const wrap = (type: string, props: Record<string, unknown>) =>
    ({
      schemaVersion: "2.0",
      root: "ROOT",
      nodes: {
        ROOT: { type: { resolvedName: "Section" }, isCanvas: true, props: {}, nodes: ["N"], linkedNodes: {}, parent: null, hidden: false, custom: {} },
        N: { type: { resolvedName: type }, isCanvas: false, props, nodes: [], linkedNodes: {}, parent: "ROOT", hidden: false, custom: {} },
      },
    }) as any;

  it("renders an Icon as an inline <svg> by lucide name", () => {
    const html = renderToStaticMarkup(
      React.createElement(RenderLayout, { data: wrap("Icon", { name: "Camera", color: "hsl(var(--primary))" }) }),
    );
    expect(html).toContain("<svg");
  });

  it("renders a YouTube Video as a sandboxed iframe embed", () => {
    const html = renderToStaticMarkup(
      React.createElement(RenderLayout, { data: wrap("Video", { src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }) }),
    );
    expect(html).toContain("<iframe");
    expect(html).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(html).toContain("sandbox=");
  });

  it("renders a direct mp4 Video as a <video>", () => {
    const html = renderToStaticMarkup(
      React.createElement(RenderLayout, { data: wrap("Video", { src: "https://cdn.example.com/clip.mp4" }) }),
    );
    expect(html).toContain("<video");
    expect(html).toContain("clip.mp4");
  });

  it("emits a responsive <picture>/srcset/sizes + intrinsic dimensions from Image variants", () => {
    const html = renderToStaticMarkup(
      React.createElement(RenderLayout, {
        data: wrap("Image", {
          imageUrl: "https://cdn.example.com/hero.jpg",
          altText: "Hero",
          intrinsicWidth: 1920,
          intrinsicHeight: 1080,
          variants: [
            { width: 320, format: "webp", url: "https://cdn.example.com/hero-320.webp" },
            { width: 640, format: "webp", url: "https://cdn.example.com/hero-640.webp" },
            { width: 1024, format: "webp", url: "https://cdn.example.com/hero-1024.webp" },
            { width: 1920, format: "webp", url: "https://cdn.example.com/hero-1920.webp" },
          ],
        }),
      }),
    );
    // <picture> with a webp <source> (next-gen) first, <img> fallback after.
    expect(html).toContain("<picture");
    expect(html).toContain('type="image/webp"');
    // srcset carries all four widths in ascending order.
    expect(html).toContain("hero-320.webp 320w");
    expect(html).toContain("hero-1920.webp 1920w");
    // Default sizes + intrinsic width/height to reserve space (no CLS) + lazy.
    expect(html).toContain('sizes="100vw"');
    expect(html).toContain('width="1920"');
    expect(html).toContain('height="1080"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
  });

  it("uses object-position from the focal point + custom sizes override", () => {
    const html = renderToStaticMarkup(
      React.createElement(RenderLayout, {
        data: wrap("Image", {
          imageUrl: "https://cdn.example.com/hero.jpg",
          intrinsicWidth: 800,
          intrinsicHeight: 600,
          sizes: "(min-width: 768px) 50vw, 100vw",
          focalPoint: { x: 0.25, y: 0.75 },
          variants: [{ width: 320, format: "webp", url: "https://cdn.example.com/hero-320.webp" }],
        }),
      }),
    );
    expect(html).toContain("(min-width: 768px) 50vw, 100vw");
    expect(html).toContain("object-position:25.00% 75.00%");
  });

  it("renders an eager/priority Image for above-the-fold/LCP", () => {
    const html = renderToStaticMarkup(
      React.createElement(RenderLayout, {
        data: wrap("Image", {
          imageUrl: "https://cdn.example.com/hero.jpg",
          loading: "eager",
          variants: [{ width: 320, format: "webp", url: "https://cdn.example.com/hero-320.webp" }],
        }),
      }),
    );
    expect(html).toContain('loading="eager"');
    expect(html.toLowerCase()).toContain('fetchpriority="high"');
  });

  it("falls back to a plain lazy <img> for an external URL with no variants (backward-compat)", () => {
    const html = renderToStaticMarkup(
      React.createElement(RenderLayout, {
        data: wrap("Image", { imageUrl: "https://external.example.com/photo.jpg", altText: "Photo" }),
      }),
    );
    expect(html).toContain("https://external.example.com/photo.jpg");
    expect(html).toContain('loading="lazy"');
    // No responsive plumbing without variants.
    expect(html).not.toContain("<picture");
    expect(html).not.toContain("srcset");
    expect(html).not.toContain("sizes=");
  });

  it("renders sanitized inline SVG on the Image block (no script)", () => {
    const html = renderToStaticMarkup(
      React.createElement(RenderLayout, {
        data: wrap("Image", { inlineSvg: '<svg viewBox="0 0 10 10"><script>alert(1)</script><path d="M0 0h10v10H0z"/></svg>' }),
      }),
    );
    expect(html).toContain("<svg");
    expect(html).toContain("<path");
    expect(html.toLowerCase()).not.toContain("<script");
  });
});

describe("XSS sanitization in components", () => {
  it("does not emit a <script> payload from a Heading text prop", () => {
    const layout = {
      schemaVersion: "2.0",
      root: "ROOT",
      nodes: {
        ROOT: {
          type: { resolvedName: "Section" },
          isCanvas: true,
          props: {},
          nodes: ["H"],
          linkedNodes: {},
          parent: null,
          hidden: false,
          custom: {},
        },
        H: {
          type: { resolvedName: "Heading" },
          isCanvas: false,
          props: { text: '<script>alert(1)</script>', level: 2 },
          nodes: [],
          linkedNodes: {},
          parent: "ROOT",
          hidden: false,
          custom: {},
        },
      },
    } as const;
    const html = renderToStaticMarkup(
      React.createElement(RenderLayout, { data: layout as any }),
    );
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("does not emit an onerror image payload via Image altText", () => {
    const layout = {
      schemaVersion: "2.0",
      root: "ROOT",
      nodes: {
        ROOT: {
          type: { resolvedName: "Section" },
          isCanvas: true,
          props: {},
          nodes: ["I"],
          linkedNodes: {},
          parent: null,
          hidden: false,
          custom: {},
        },
        I: {
          type: { resolvedName: "Image" },
          isCanvas: false,
          props: { imageUrl: "", altText: '"><img src=x onerror=alert(1)>' },
          nodes: [],
          linkedNodes: {},
          parent: "ROOT",
          hidden: false,
          custom: {},
        },
      },
    };
    const html = renderToStaticMarkup(
      React.createElement(RenderLayout, { data: layout as any }),
    );
    // The payload must not appear as a live <img ... onerror> element (the
    // angle brackets are escaped, so no real tag can break out of the attr).
    expect(html).not.toContain("<img src=x onerror");
  });
});
