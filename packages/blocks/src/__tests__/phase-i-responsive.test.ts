import { describe, expect, it } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Gallery } from "../blocks/showcase";
import { LogoCarousel } from "../blocks/carousels";
import { CounterSection } from "../blocks/marketing";
import { isHiddenAtBreakpointForPreview } from "@ob-cms/block-schema";
import { cssFromStyles } from "../lib";
import { styleBreakpointRef } from "../style-breakpoint-context";

describe("Phase I — renderer responsive consumption", () => {
  it("Gallery applies partStyles.grid gap to grid element markup", () => {
    const html = renderToStaticMarkup(
      React.createElement(Gallery, {
        columns: 3,
        images: [{ imageUrl: "https://example.com/a.jpg", caption: "A" }],
        partStyles: {
          grid: {
            spacing: { gap: "48px" },
            layout: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
          },
        },
      }),
    );
    expect(html).toContain("ob-gallery__grid");
    expect(html).toContain("repeat(2, minmax(0, 1fr))");
    expect(html).toMatch(/gap:.*48px/);
  });

  it("Logo Carousel applies partStyles.grid gap on track", () => {
    const html = renderToStaticMarkup(
      React.createElement(LogoCarousel, {
        logos: ["https://example.com/logo.png"],
        partStyles: {
          grid: { spacing: { gap: "20px" } },
        },
      }),
    );
    expect(html).toContain("ob-logo-carousel__track");
    expect(html).toMatch(/gap:.*20px/);
  });

  it("Counter Section partStyles.grid overrides static columns via StyleModel", () => {
    const html = renderToStaticMarkup(
      React.createElement(CounterSection, {
        columns: 3,
        stats: [{ value: "1", label: "One" }],
        partStyles: {
          grid: { layout: { gridTemplateColumns: "repeat(1, minmax(0, 1fr))" } },
        },
      }),
    );
    expect(html).toContain("repeat(1, minmax(0, 1fr))");
  });

  it("cssFromStyles hides on desktop preview and shows on tablet when desktop.hidden", () => {
    const styles = { responsive: { desktop: { hidden: true } } };
    styleBreakpointRef.current = "desktop";
    try {
      const desktopCss = cssFromStyles(styles);
      expect(desktopCss.display).toBe("none");
    } finally {
      styleBreakpointRef.current = undefined;
    }
    styleBreakpointRef.current = "tablet";
    try {
      const tabletCss = cssFromStyles(styles);
      expect(tabletCss.display).not.toBe("none");
      expect(isHiddenAtBreakpointForPreview(styles, "tablet")).toBe(false);
    } finally {
      styleBreakpointRef.current = undefined;
    }
  });

  it("published path emits desktop-band hide CSS var", () => {
    styleBreakpointRef.current = undefined;
    const css = cssFromStyles({ responsive: { desktop: { hidden: true } } });
    expect(css["--ob-r-desktop-band-display"]).toBe("none");
  });
});
