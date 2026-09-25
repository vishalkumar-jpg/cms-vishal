import { describe, it, expect } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OBSiteRootBreakpointSources } from "@ob-cms/blocks";
import {
  composePublishedPageLayout,
  hasBlockGlobalChrome,
} from "./compose-published-page-layout";
import { PublishedPageFrame } from "../components/published-page-frame";
import type { SerializedLayout } from "@ob-cms/block-schema";

const rendererAppDir = join(import.meta.dirname, "..", "app");

const minimalLayout = (): SerializedLayout =>
  ({
    schemaVersion: "2.0",
    root: "ROOT",
    nodes: {
      ROOT: {
        type: { resolvedName: "Section" },
        isCanvas: true,
        props: {},
        nodes: ["BODY"],
        linkedNodes: {},
        parent: null,
        hidden: false,
        custom: {},
      },
      BODY: {
        type: { resolvedName: "Heading" },
        isCanvas: false,
        props: { text: "Body", level: 1 },
        nodes: [],
        linkedNodes: {},
        parent: "ROOT",
        hidden: false,
        custom: {},
      },
    },
  }) as unknown as SerializedLayout;

describe("composePublishedPageLayout", () => {
  it("returns the page layout unchanged when chrome is absent", () => {
    const page = minimalLayout();
    expect(composePublishedPageLayout(page, null, null)).toBe(page);
  });

  it("prepends and appends cloned chrome roots around the page body", () => {
    const page = minimalLayout();
    const header = minimalLayout();
    header.root = "HROOT";
    header.nodes.HROOT = { ...header.nodes.ROOT, nodes: ["H"] };
    header.nodes.H = {
      type: { resolvedName: "Heading" },
      isCanvas: false,
      props: { text: "Header", level: 2 },
      nodes: [],
      linkedNodes: {},
      parent: "HROOT",
      hidden: false,
      custom: {},
    };

    const composed = composePublishedPageLayout(page, header, null);
    const rootChildren = composed.nodes[composed.root]?.nodes ?? [];
    expect(rootChildren.length).toBe(2);
    expect(hasBlockGlobalChrome(header, null)).toBe(true);
  });
});

describe("renderer published page wiring", () => {
  it("PublishedPageFrame passes container breakpointSource through to OBSiteRoot", () => {
    expect(OBSiteRootBreakpointSources.container).toBe("container");

    const html = renderToStaticMarkup(
      React.createElement(PublishedPageFrame, {
        pageLayout: minimalLayout(),
        headerLayout: null,
        footerLayout: null,
      }),
    );

    expect(html).toContain('class="ob-site');
    expect(html).toContain('data-ob-breakpoint="desktop"');
    expect(html).toContain('data-ob-viewport="desktop"');
  });

  it("catch-all page uses PublishedPageFrame with a single RenderLayout path", () => {
    const source = readFileSync(join(rendererAppDir, "[[...slug]]", "page.tsx"), "utf-8");
    expect(source).toContain("PublishedPageFrame");
    expect(source).not.toMatch(/headerLayout\s*&&[\s\S]*<RenderLayout/);
    expect(source).not.toContain("<SiteHeader");
  });

  it("token preview page route uses PublishedPageFrame for pages", () => {
    const source = readFileSync(
      join(rendererAppDir, "%5F%5Fpreview", "[type]", "[id]", "page.tsx"),
      "utf-8",
    );
    expect(source).toContain("PublishedPageFrame");
  });
});
