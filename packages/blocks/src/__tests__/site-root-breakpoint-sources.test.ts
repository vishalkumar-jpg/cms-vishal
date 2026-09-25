import { describe, it, expect } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Window as HappyWindow } from "happy-dom";
import {
  OBSiteRootBreakpointSources as fromDedicatedModule,
} from "../site-root-breakpoint-sources";
import {
  OBSiteRootBreakpointSources as fromBarrel,
  RenderLayout,
} from "../index";
import type { SerializedLayout } from "@ob-cms/block-schema";

if (typeof globalThis.document === "undefined") {
  const win = new HappyWindow();
  globalThis.window = win as unknown as Window & typeof globalThis.window;
  globalThis.document = win.document;
  globalThis.HTMLElement = win.HTMLElement;
}

const minimalLayout = (): SerializedLayout =>
  ({
    schemaVersion: "2.0",
    root: "ROOT",
    nodes: {
      ROOT: {
        type: { resolvedName: "Section" },
        isCanvas: true,
        props: {},
        nodes: [],
        linkedNodes: {},
        parent: null,
        hidden: false,
        custom: {},
      },
    },
  }) as unknown as SerializedLayout;

describe("OBSiteRootBreakpointSources (server-safe module)", () => {
  it("exports container as the literal string container", () => {
    expect(fromDedicatedModule.container).toBe("container");
    expect(fromDedicatedModule.container).not.toBeUndefined();
  });

  it("barrel export resolves to the same server-safe constant object", () => {
    expect(fromBarrel.container).toBe("container");
    expect(fromBarrel).toBe(fromDedicatedModule);
  });

  it("PublishedPageFrame-style RenderLayout wiring receives container, not undefined", () => {
    const breakpointSource = fromBarrel.container;
    expect(breakpointSource).toBe("container");

    const html = renderToStaticMarkup(
      React.createElement(RenderLayout, {
        data: minimalLayout(),
        breakpointSource,
      }),
    );
    expect(html).toContain('data-ob-breakpoint="desktop"');
    expect(html).toContain('data-ob-viewport="desktop"');
  });
});
