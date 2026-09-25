import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as React from "react";
import { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot, type Root } from "react-dom/client";
import { Window as HappyWindow } from "happy-dom";
import {
  CONTAINER_BREAKPOINT_MIN_WIDTH,
  LARGE_DESKTOP_CONTAINER_MIN_WIDTH,
  type SerializedLayout,
} from "@ob-cms/block-schema";
import { RenderLayout, OBSiteRoot, OBSiteRootBreakpointSources, blockRegistry } from "../index";
import { StyleBreakpointBlock } from "../style-breakpoint-block";
import type { BlockComponent } from "../registry";

const Heading = blockRegistry.Heading.component;
const Row = blockRegistry.Row.component;
const Column = blockRegistry.Column.component;

const block = (
  component: BlockComponent,
  props: Record<string, unknown>,
  ...children: React.ReactNode[]
) =>
  React.createElement(
    StyleBreakpointBlock,
    { component, ...props },
    children.length > 0 ? children : undefined,
  );
import {
  cssFromStyles,
  authoredLayoutAttr,
  withAuthorTypography,
  applyRootBlockStyles,
} from "../lib";
import { styleBreakpointRef } from "../style-breakpoint-context";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

if (typeof globalThis.document === "undefined") {
  const win = new HappyWindow();
  globalThis.window = win as unknown as Window & typeof globalThis.window;
  globalThis.document = win.document;
  globalThis.HTMLElement = win.HTMLElement;
}

const INITIAL_DESKTOP_CONTAINER_WIDTH = LARGE_DESKTOP_CONTAINER_MIN_WIDTH;

const stubContainerWidth = (width: number, height = 0) => {
  HTMLElement.prototype.getBoundingClientRect = function () {
    return {
      width,
      height,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  };
};

type ResizeObserverTestHarness = {
  reactRoot: Root;
  mountHost: HTMLElement;
  resizeCallback: ResizeObserverCallback;
  triggerWidth: (width: number) => void;
};

const createResizeObserverTestHarness = (): ResizeObserverTestHarness => {
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
    styleBreakpointRef.current = undefined;
  });

  const triggerWidth = (width: number) => {
    act(() => {
      resizeCallback!(
        [{ contentRect: { width, height: 0 } as DOMRectReadOnly } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });
  };

  return {
    get reactRoot() {
      if (reactRoot == null) throw new Error("ResizeObserver test harness not initialized");
      return reactRoot;
    },
    get mountHost() {
      if (mountHost == null) throw new Error("ResizeObserver test harness not initialized");
      return mountHost;
    },
    get resizeCallback() {
      if (resizeCallback == null) throw new Error("ResizeObserver test harness not initialized");
      return resizeCallback;
    },
    triggerWidth,
  };
};

/** Hero H1: desktop 48px with explicit mobile/tablet layers; laptop inherits desktop. */
const HERO_HEADING_STYLES = {
  typography: { fontSize: "48px", letterSpacing: "0px", lineHeight: "1.2" },
  responsive: {
    mobile: { typography: { fontSize: "35px", letterSpacing: "0.5px" } },
    tablet: { typography: { fontSize: "41px" } },
  },
};

const SPLIT_ROW_STYLES = {
  layout: { display: "flex", flexDirection: "row" },
  responsive: { mobile: { layout: { flexDirection: "column" } } },
};

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
        props: { text: "Remote Staffing", level: 1 },
        nodes: [],
        linkedNodes: {},
        parent: "ROOT",
        hidden: false,
        custom: {},
      },
    },
  }) as unknown as SerializedLayout;

/** Mirrors `DeviceFrame.breakpointForPreset` in admin Preview route. */
const previewBreakpointForDeviceKey = (
  key: "iphone15" | "ipad" | "laptop" | "desktop",
): "mobile" | "tablet" | "laptop" | "desktop" => {
  if (key === "iphone15") return "mobile";
  if (key === "ipad") return "tablet";
  if (key === "laptop") return "laptop";
  return "desktop";
};

const viewportModeForPreviewBreakpoint = (bp: string) =>
  bp === "mobile" ? "mobile" : bp === "tablet" ? "tablet" : "desktop";

const authorFontSizeFromHeading = (heading: HTMLElement) =>
  heading.style.getPropertyValue("--ob-author-font-size") || heading.style.fontSize;

describe("published inline style re-resolution (cssFromStyles)", () => {
  afterEach(() => {
    styleBreakpointRef.current = undefined;
  });

  it("SSR/desktop path uses fluid clamp before breakpoint is known", () => {
    styleBreakpointRef.current = "desktop";
    const desktop = cssFromStyles(HERO_HEADING_STYLES);
    expect(String(desktop.fontSize)).toContain("clamp(");
  });

  it("mobile resolves explicit mobile typography", () => {
    styleBreakpointRef.current = "mobile";
    const mobile = cssFromStyles(HERO_HEADING_STYLES);
    expect(mobile.fontSize).toBe("35px");
    expect(String(mobile.fontSize)).not.toContain("clamp");
  });

  it("tablet resolves explicit tablet typography", () => {
    styleBreakpointRef.current = "tablet";
    const tablet = cssFromStyles(HERO_HEADING_STYLES);
    expect(tablet.fontSize).toBe("41px");
    expect(String(tablet.fontSize)).not.toContain("clamp");
  });

  it("laptop resolves inherited desktop typography without fluid clamp (1024px parity)", () => {
    styleBreakpointRef.current = "laptop";
    const laptop = cssFromStyles(HERO_HEADING_STYLES);
    expect(laptop.fontSize).toBe("48px");
    expect(String(laptop.fontSize)).not.toContain("clamp");
  });

  it("authored typography vars reflect effective breakpoint after re-resolution", () => {
    styleBreakpointRef.current = "laptop";
    const style = withAuthorTypography(applyRootBlockStyles(HERO_HEADING_STYLES));
    expect(style.fontSize).toBe("48px");
    expect(style["--ob-author-font-size"]).toBe("48px");
  });

  it("data-ob-keep-row remains correct at mobile breakpoint", () => {
    styleBreakpointRef.current = "mobile";
    const resolved = cssFromStyles(SPLIT_ROW_STYLES);
    const attrs = authoredLayoutAttr(SPLIT_ROW_STYLES, resolved);
    expect(attrs["data-ob-keep-row"]).toBeUndefined();
    expect(resolved.flexDirection).toBe("column");
  });
});

describe("published inline style re-resolution (explicit preview breakpoint)", () => {
  it("preview laptop renders 48px H1 without clamp via SSR", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        OBSiteRoot,
        { breakpoint: "laptop", viewportMode: "desktop" },
        block(Heading, {
          text: "Remote Staffing",
          level: 1,
          styles: HERO_HEADING_STYLES,
        }),
      ),
    );
    expect(html).toContain("font-size:48px");
    expect(html).not.toContain("clamp(");
    expect(html).toContain('data-ob-breakpoint="laptop"');
  });

  it("preview laptop at 1280 uses laptop style breakpoint and 48px author typography", () => {
    const mountHost = document.createElement("div");
    document.body.appendChild(mountHost);
    const root = createRoot(mountHost);

    act(() => {
      root.render(
        React.createElement(
          OBSiteRoot,
          { breakpoint: "laptop", viewportMode: "desktop" },
          block(Heading, {
            text: "Remote Staffing",
            level: 1,
            styles: HERO_HEADING_STYLES,
          }),
        ),
      );
    });

    const site = mountHost.querySelector(".ob-site") as HTMLElement;
    const heading = mountHost.querySelector(".ob-site h1") as HTMLElement;
    expect(site.getAttribute("data-ob-breakpoint")).toBe("laptop");
    expect(styleBreakpointRef.current).toBe("laptop");
    expect(authorFontSizeFromHeading(heading)).toBe("48px");
    expect(heading.getAttribute("style") ?? "").not.toMatch(/clamp\(/);

    act(() => {
      root.unmount();
    });
    mountHost.remove();
    styleBreakpointRef.current = undefined;
  });

  it("builder desktop breakpoint keeps fluid clamp typography", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        OBSiteRoot,
        { breakpoint: "desktop", viewportMode: "desktop", "data-ob-builder-canvas": "true" },
        block(Heading, {
          text: "Remote Staffing",
          level: 1,
          styles: HERO_HEADING_STYLES,
        }),
      ),
    );
    expect(html).toMatch(/clamp\(/);
    expect(html).toContain('data-ob-breakpoint="desktop"');
  });
});

describe("published inline style re-resolution (container ResizeObserver)", () => {
  const harness = createResizeObserverTestHarness();

  const mountHero = () => {
    act(() => {
      harness.reactRoot.render(
        React.createElement(
          OBSiteRoot,
          { breakpointSource: OBSiteRootBreakpointSources.container },
          block(Heading, {
            text: "Remote Staffing",
            level: 1,
            styles: HERO_HEADING_STYLES,
          }),
        ),
      );
    });
    return harness.mountHost.querySelector(".ob-site h1") as HTMLElement;
  };

  it("seeds desktop SSR safely then re-resolves at laptop (1024px → 48px, no clamp)", () => {
    const { laptop } = CONTAINER_BREAKPOINT_MIN_WIDTH;

    stubContainerWidth(INITIAL_DESKTOP_CONTAINER_WIDTH);

    const heading = mountHero();
    const siteRoot = harness.mountHost.querySelector(".ob-site") as HTMLElement;
    expect(siteRoot.getAttribute("data-ob-breakpoint")).toBe("desktop");
    expect(heading.getAttribute("style") ?? "").toMatch(/clamp\(/);

    harness.triggerWidth(laptop);

    expect(siteRoot.getAttribute("data-ob-breakpoint")).toBe("laptop");
    const laptopHeading = harness.mountHost.querySelector(".ob-site h1") as HTMLElement;
    const laptopStyle = laptopHeading.getAttribute("style") ?? "";
    expect(laptopStyle).toMatch(/font-size:\s*48px/);
    expect(laptopStyle).not.toMatch(/clamp\(/);
  });

  it("re-resolves mobile and tablet typography after container width changes", () => {
    const { tablet, laptop } = CONTAINER_BREAKPOINT_MIN_WIDTH;

    stubContainerWidth(INITIAL_DESKTOP_CONTAINER_WIDTH);

    mountHero();

    harness.triggerWidth(tablet);
    expect(harness.mountHost.querySelector(".ob-site h1")!.getAttribute("style") ?? "").toMatch(
      /font-size:\s*41px/,
    );

    harness.triggerWidth(393);
    expect(harness.mountHost.querySelector(".ob-site h1")!.getAttribute("style") ?? "").toMatch(
      /font-size:\s*35px/,
    );

    harness.triggerWidth(laptop);
    expect(harness.mountHost.querySelector(".ob-site h1")!.getAttribute("style") ?? "").toMatch(
      /font-size:\s*48px/,
    );
  });

  it("re-resolves split-row subtree so mobile column stack applies after detection", () => {
    stubContainerWidth(INITIAL_DESKTOP_CONTAINER_WIDTH);

    act(() => {
      harness.reactRoot.render(
        React.createElement(
          OBSiteRoot,
          { breakpointSource: OBSiteRootBreakpointSources.container },
          React.createElement(
            StyleBreakpointBlock,
            { component: Row, styles: SPLIT_ROW_STYLES, className: "ob-split-row" },
            React.createElement(Column, { key: "a" }, "Copy"),
            React.createElement(Column, { key: "b" }, "Image"),
          ),
        ),
      );
    });

    const rowStyle = () => harness.mountHost.querySelector(".ob-split-row")!.getAttribute("style") ?? "";
    expect(rowStyle()).toMatch(/flex-direction:\s*row/);

    harness.triggerWidth(393);

    expect(rowStyle()).toMatch(/flex-direction:\s*column/);
    expect(harness.mountHost.querySelector(".ob-split-row")!.hasAttribute("data-ob-keep-row")).toBe(
      false,
    );
  });

  it("desktop container width at largeDesktop band keeps fluid desktop typography", () => {
    stubContainerWidth(INITIAL_DESKTOP_CONTAINER_WIDTH);

    const heading = mountHero();
    expect(heading.getAttribute("style") ?? "").toMatch(/clamp\(/);
  });

  it("published 1280 uses desktop label with laptop-authored 48px typography", () => {
    const width = CONTAINER_BREAKPOINT_MIN_WIDTH.desktop;

    stubContainerWidth(width);

    mountHero();
    harness.triggerWidth(width);

    const siteRoot = harness.mountHost.querySelector(".ob-site") as HTMLElement;
    const heading = harness.mountHost.querySelector(".ob-site h1") as HTMLElement;
    expect(siteRoot.getAttribute("data-ob-breakpoint")).toBe("desktop");
    expect(styleBreakpointRef.current).toBe("laptop");
    expect(authorFontSizeFromHeading(heading)).toBe("48px");
    expect(heading.getAttribute("style") ?? "").not.toMatch(/clamp\(/);
  });

  it("re-resolves from laptop-authored 1280 to desktop fluid typography at largeDesktop band", () => {
    const width1280 = CONTAINER_BREAKPOINT_MIN_WIDTH.desktop;

    stubContainerWidth(width1280);

    mountHero();
    harness.triggerWidth(width1280);

    const siteRoot = harness.mountHost.querySelector(".ob-site") as HTMLElement;
    let heading = harness.mountHost.querySelector(".ob-site h1") as HTMLElement;
    expect(siteRoot.getAttribute("data-ob-breakpoint")).toBe("desktop");
    expect(styleBreakpointRef.current).toBe("laptop");
    expect(authorFontSizeFromHeading(heading)).toBe("48px");
    expect(heading.getAttribute("style") ?? "").not.toMatch(/clamp\(/);

    harness.triggerWidth(LARGE_DESKTOP_CONTAINER_MIN_WIDTH);

    heading = harness.mountHost.querySelector(".ob-site h1") as HTMLElement;
    expect(siteRoot.getAttribute("data-ob-breakpoint")).toBe("desktop");
    expect(styleBreakpointRef.current).toBe("desktop");
    expect(heading.getAttribute("style") ?? "").toMatch(/clamp\(/);
  });
});

describe("Preview vs Published parity (real Preview device mapping)", () => {
  const harness = createResizeObserverTestHarness();

  const mountPreview = (deviceKey: "iphone15" | "ipad" | "laptop" | "desktop", width: number) => {
    const previewBp = previewBreakpointForDeviceKey(deviceKey);
    stubContainerWidth(width, 900);

    act(() => {
      harness.reactRoot.render(
        React.createElement(
          OBSiteRoot,
          {
            breakpoint: previewBp,
            viewportMode: viewportModeForPreviewBreakpoint(previewBp),
          },
          block(Heading, {
            text: "Remote Staffing",
            level: 1,
            styles: HERO_HEADING_STYLES,
          }),
        ),
      );
    });

    const site = harness.mountHost.querySelector(".ob-site") as HTMLElement;
    const heading = harness.mountHost.querySelector(".ob-site h1") as HTMLElement;
    return {
      dataBp: site.getAttribute("data-ob-breakpoint"),
      author: authorFontSizeFromHeading(heading),
      hasClamp: (heading.getAttribute("style") ?? "").includes("clamp"),
    };
  };

  const mountPublished = (width: number) => {
    stubContainerWidth(width, 900);

    act(() => {
      harness.reactRoot.render(
        React.createElement(
          OBSiteRoot,
          { breakpointSource: OBSiteRootBreakpointSources.container },
          block(Heading, {
            text: "Remote Staffing",
            level: 1,
            styles: HERO_HEADING_STYLES,
          }),
        ),
      );
    });

    harness.triggerWidth(width);

    const site = harness.mountHost.querySelector(".ob-site") as HTMLElement;
    const heading = harness.mountHost.querySelector(".ob-site h1") as HTMLElement;
    return {
      dataBp: site.getAttribute("data-ob-breakpoint"),
      author: authorFontSizeFromHeading(heading),
      hasClamp: (heading.getAttribute("style") ?? "").includes("clamp"),
    };
  };

  const parityCases = [
    {
      width: 393,
      previewDevice: "iphone15" as const,
      expectedPublishedBp: "mobile",
      expectedSize: "35px",
      expectClamp: false,
    },
    {
      width: 820,
      previewDevice: "ipad" as const,
      expectedPublishedBp: "tablet",
      expectedSize: "41px",
      expectClamp: false,
    },
    {
      width: 1024,
      previewDevice: "laptop" as const,
      expectedPublishedBp: "laptop",
      expectedSize: "48px",
      expectClamp: false,
    },
    {
      width: CONTAINER_BREAKPOINT_MIN_WIDTH.desktop,
      previewDevice: "laptop" as const,
      expectedPublishedBp: "desktop",
      expectedSize: "48px",
      expectClamp: false,
    },
    {
      width: LARGE_DESKTOP_CONTAINER_MIN_WIDTH,
      previewDevice: "desktop" as const,
      expectedPublishedBp: "desktop",
      expectedSize: "",
      expectClamp: true,
    },
  ] as const;

  it.each(parityCases)(
    "$width px Preview device vs Published authored parity",
    ({ width, previewDevice, expectedPublishedBp, expectedSize, expectClamp }) => {
      const preview = mountPreview(previewDevice, width);
      const published = mountPublished(width);

      expect(published.dataBp).toBe(expectedPublishedBp);
      expect(preview.author).toBe(published.author);
      expect(preview.hasClamp).toBe(published.hasClamp);

      if (expectedSize) {
        expect(preview.author).toBe(expectedSize);
        expect(published.author).toBe(expectedSize);
      }
      expect(preview.hasClamp).toBe(expectClamp);
      expect(published.hasClamp).toBe(expectClamp);
    },
  );

  it("1280 Preview Laptop vs Published: labels may differ, authored font-size must match", () => {
    const width = CONTAINER_BREAKPOINT_MIN_WIDTH.desktop;
    const preview = mountPreview("laptop", width);
    const published = mountPublished(width);

    expect(preview.dataBp).toBe("laptop");
    expect(published.dataBp).toBe("desktop");
    expect(styleBreakpointRef.current).toBe("laptop");
    expect(preview.author).toBe("48px");
    expect(published.author).toBe("48px");
    expect(preview.author).toBe(published.author);
    expect(preview.hasClamp).toBe(false);
    expect(published.hasClamp).toBe(false);
  });
});

describe("RenderLayout container breakpoint wiring (SSR seed)", () => {
  it("seeds desktop breakpoint attrs on SSR before client measure", () => {
    const html = renderToStaticMarkup(
      React.createElement(RenderLayout, {
        data: minimalLayout(),
        breakpointSource: OBSiteRootBreakpointSources.container,
      }),
    );
    expect(html).toContain('data-ob-breakpoint="desktop"');
    expect(html).toContain('data-ob-viewport="desktop"');
  });
});

/** OB homepage topbar "Log In" — linkStyles must beat largeDesktop StyleModel typography. */
const TOPBAR_LOGIN_STYLE_MODEL_FONT_SIZE = 30;
const TOPBAR_LOGIN_LINK_FONT_SIZE = 14;
const MOBILE_CONTAINER_WIDTH = 390;

const OB_TOPBAR_LOGIN_STYLES = {
  colors: { textColor: "hsl(var(--background))" },
  typography: {
    fontSize: 12,
    fontFamily: "'Open Sans', system-ui, sans-serif",
    fontWeight: "600",
    lineHeight: 1.25,
    letterSpacing: 0,
  },
  responsive: {
    mobile: {},
    tablet: {},
    __generated: { mobile: {}, tablet: {} },
    largeDesktop: {
      typography: {
        fontSize: TOPBAR_LOGIN_STYLE_MODEL_FONT_SIZE,
        fontWeight: "600",
        lineHeight: 1.25,
        letterSpacing: 0,
      },
    },
  },
};

const OB_TOPBAR_LINK_STYLES = {
  color: "#ffffff",
  fontSize: TOPBAR_LOGIN_LINK_FONT_SIZE,
  textDecoration: "none",
};

describe("Link block topbar login typography (Published largeDesktop)", () => {
  const harness = createResizeObserverTestHarness();
  const Link = blockRegistry.Link.component;

  const mountTopbarLogin = (width: number) => {
    stubContainerWidth(width, 40);
    act(() => {
      harness.reactRoot.render(
        React.createElement(
          OBSiteRoot,
          { breakpointSource: OBSiteRootBreakpointSources.container },
          block(Link, {
            text: "Log In",
            url: "https://example.com/login",
            styles: OB_TOPBAR_LOGIN_STYLES,
            linkStyles: OB_TOPBAR_LINK_STYLES,
          }),
        ),
      );
    });
    harness.triggerWidth(width);
    return harness.mountHost.querySelector(".ob-link a") as HTMLAnchorElement;
  };

  it("keeps linkStyles font-size at largeDesktop container width (not StyleModel override)", () => {
    const anchor = mountTopbarLogin(LARGE_DESKTOP_CONTAINER_MIN_WIDTH);
    expect(anchor).toBeTruthy();
    expect(anchor.style.fontSize).toBe(`${TOPBAR_LOGIN_LINK_FONT_SIZE}px`);
    expect(anchor.style.fontSize).not.toBe(`${TOPBAR_LOGIN_STYLE_MODEL_FONT_SIZE}px`);
    expect(anchor.style.getPropertyValue("--ob-r-largeDesktop-fontSize")).toBe("");
    expect(window.getComputedStyle(anchor).fontSize).toBe(`${TOPBAR_LOGIN_LINK_FONT_SIZE}px`);
  });

  it("matches linkStyles font-size at laptop-width container", () => {
    const anchor = mountTopbarLogin(CONTAINER_BREAKPOINT_MIN_WIDTH.desktop);
    expect(anchor.style.fontSize).toBe(`${TOPBAR_LOGIN_LINK_FONT_SIZE}px`);
  });

  it.each([
    { label: "tablet", width: CONTAINER_BREAKPOINT_MIN_WIDTH.tablet },
    { label: "mobile", width: MOBILE_CONTAINER_WIDTH },
  ])("matches linkStyles font-size at $label container width", ({ width }) => {
    const anchor = mountTopbarLogin(width);
    expect(anchor.style.fontSize).toBe(`${TOPBAR_LOGIN_LINK_FONT_SIZE}px`);
  });
});
