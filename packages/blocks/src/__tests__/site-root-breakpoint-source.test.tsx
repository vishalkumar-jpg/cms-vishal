import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as React from "react";
import { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot, type Root } from "react-dom/client";
import { Window as HappyWindow } from "happy-dom";
import { RenderLayout, OBSiteRoot, OBSiteRootBreakpointSources } from "../index";
import {
  CONTAINER_BREAKPOINT_MIN_WIDTH,
  type SerializedLayout,
} from "@ob-cms/block-schema";

if (typeof globalThis.document === "undefined") {
  const win = new HappyWindow();
  globalThis.window = win as unknown as Window & typeof globalThis.window;
  globalThis.document = win.document;
  globalThis.HTMLElement = win.HTMLElement;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
}

const INITIAL_DESKTOP_CONTAINER_WIDTH = 1440;

const minimalLayout = (): SerializedLayout =>
  ({
    schemaVersion: "2.0",
    root: "ROOT",
    nodes: {
      ROOT: {
        type: { resolvedName: "Section" },
        isCanvas: true,
        props: {},
        nodes: ["N"],
        linkedNodes: {},
        parent: null,
        hidden: false,
        custom: {},
      },
      N: {
        type: { resolvedName: "Heading" },
        isCanvas: false,
        props: { text: "Hello", level: 1 },
        nodes: [],
        linkedNodes: {},
        parent: "ROOT",
        hidden: false,
        custom: {},
      },
    },
  }) as unknown as SerializedLayout;

describe("OBSiteRoot breakpointSource opt-in", () => {
  it("explicit breakpoint + viewportMode are unchanged", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        OBSiteRoot,
        { breakpoint: "mobile", viewportMode: "mobile" },
        React.createElement("span", null, "child"),
      ),
    );
    expect(html).toContain('data-ob-breakpoint="mobile"');
    expect(html).toContain('data-ob-viewport="mobile"');
  });

  it("breakpointSource=container seeds desktop attrs on SSR before client measure", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        OBSiteRoot,
        { breakpointSource: OBSiteRootBreakpointSources.container },
        React.createElement("span", null, "child"),
      ),
    );
    expect(html).toContain('data-ob-breakpoint="desktop"');
    expect(html).toContain('data-ob-viewport="desktop"');
  });

  it("no breakpoint and no breakpointSource omits auto-detection attrs", () => {
    const html = renderToStaticMarkup(
      React.createElement(OBSiteRoot, null, React.createElement("span", null, "child")),
    );
    expect(html).not.toContain("data-ob-breakpoint");
    expect(html).not.toContain("data-ob-viewport");
  });

  it("explicit breakpoint wins over breakpointSource=container", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        OBSiteRoot,
        {
          breakpoint: "tablet",
          viewportMode: "tablet",
          breakpointSource: OBSiteRootBreakpointSources.container,
        },
        React.createElement("span", null, "child"),
      ),
    );
    expect(html).toContain('data-ob-breakpoint="tablet"');
    expect(html).toContain('data-ob-viewport="tablet"');
  });
});

describe("OBSiteRoot container ResizeObserver (client)", () => {
  let reactRoot: Root | null = null;
  let mountHost: HTMLElement | null = null;
  let resizeCallback: ResizeObserverCallback | null = null;
  let originalResizeObserver: typeof ResizeObserver | undefined;
  let originalGetBoundingClientRect: typeof HTMLElement.prototype.getBoundingClientRect;

  beforeEach(() => {
    resizeCallback = null;
    originalResizeObserver = globalThis.ResizeObserver;
    originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

    globalThis.ResizeObserver = class MockResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }
      observe() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;

    mountHost = document.createElement("div");
    document.body.appendChild(mountHost);
    reactRoot = createRoot(mountHost);
  });

  afterEach(() => {
    act(() => {
      reactRoot?.unmount();
    });
    mountHost?.remove();
    globalThis.ResizeObserver = originalResizeObserver!;
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    reactRoot = null;
    mountHost = null;
    resizeCallback = null;
  });

  it("updates data attrs when ResizeObserver reports container width", () => {
    const { tablet, laptop } = CONTAINER_BREAKPOINT_MIN_WIDTH;

    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      return {
        width: INITIAL_DESKTOP_CONTAINER_WIDTH,
        height: 0,
        top: 0,
        left: 0,
        right: INITIAL_DESKTOP_CONTAINER_WIDTH,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    };

    act(() => {
      reactRoot!.render(
        React.createElement(
          OBSiteRoot,
          { breakpointSource: OBSiteRootBreakpointSources.container },
          React.createElement("span", null, "child"),
        ),
      );
    });

    const siteRoot = mountHost!.querySelector(".ob-site") as HTMLElement;
    expect(siteRoot).toBeTruthy();
    expect(resizeCallback).toBeTruthy();
    expect(siteRoot.getAttribute("data-ob-breakpoint")).toBe("desktop");
    expect(siteRoot.getAttribute("data-ob-viewport")).toBe("desktop");

    act(() => {
      resizeCallback!(
        [
          {
            contentRect: { width: tablet, height: 0 } as DOMRectReadOnly,
          } as ResizeObserverEntry,
        ],
        {} as ResizeObserver,
      );
    });

    expect(siteRoot.getAttribute("data-ob-breakpoint")).toBe("tablet");
    expect(siteRoot.getAttribute("data-ob-viewport")).toBe("tablet");

    act(() => {
      resizeCallback!(
        [
          {
            contentRect: { width: laptop, height: 0 } as DOMRectReadOnly,
          } as ResizeObserverEntry,
        ],
        {} as ResizeObserver,
      );
    });

    expect(siteRoot.getAttribute("data-ob-breakpoint")).toBe("laptop");
    expect(siteRoot.getAttribute("data-ob-viewport")).toBe("desktop");
  });
});

describe("RenderLayout published breakpointSource wiring", () => {
  it("RenderLayout without breakpointSource does not emit breakpoint attrs", () => {
    const html = renderToStaticMarkup(
      React.createElement(RenderLayout, { data: minimalLayout() }),
    );
    expect(html).toContain('class="ob-site');
    expect(html).not.toContain("data-ob-breakpoint");
    expect(html).not.toContain("data-ob-viewport");
  });

  it("RenderLayout with breakpointSource=container enables container detection", () => {
    const html = renderToStaticMarkup(
      React.createElement(RenderLayout, {
        data: minimalLayout(),
        breakpointSource: OBSiteRootBreakpointSources.container,
      }),
    );
    expect(html).toContain('data-ob-breakpoint="desktop"');
    expect(html).toContain('data-ob-viewport="desktop"');
  });

  it("preview page RenderLayout config (breakpointSource=container + env) emits breakpoint attrs", () => {
    const html = renderToStaticMarkup(
      React.createElement(RenderLayout, {
        data: minimalLayout(),
        breakpointSource: OBSiteRootBreakpointSources.container,
        env: { locale: "en" },
      }),
    );
    expect(html).toContain('class="ob-site');
    expect(html).toContain('data-ob-breakpoint="desktop"');
    expect(html).toContain('data-ob-viewport="desktop"');
  });
});
