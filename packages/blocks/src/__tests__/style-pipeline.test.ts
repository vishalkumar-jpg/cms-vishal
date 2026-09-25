import { describe, it, expect } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  STYLE_AUDIT_FIXTURE,
  STYLE_AUDIT_EXPECTED,
  verifyStylePipeline,
  STYLE_AUDIT_BLOCK_COUNT,
} from "../style-verification";
import { Button, Heading, Badge, FloatingCta, Image } from "../index";
import { cssFromStyles, applyRootBlockStyles, mergeVisualStyles } from "../lib";
import { styleBreakpointRef } from "../style-breakpoint-context";

describe("Style pipeline audit", () => {
  it("STYLE_AUDIT_FIXTURE resolves expected desktop properties", () => {
    const results = verifyStylePipeline();
    const failures = results.filter((r) => !r.pass);
    if (failures.length) {
      console.error("Pipeline failures:", failures);
    }
    expect(failures.length).toBe(0);
  });

  it("mergeVisualStyles clears conflicting shorthands", () => {
    const merged = mergeVisualStyles(
      { background: "red", border: "1px solid black", padding: "4px" },
      { backgroundColor: "#147eff", borderColor: "#fff", paddingTop: "8px" },
    );
    expect(merged.backgroundColor).toBe("#147eff");
    expect(merged.background).toBeUndefined();
    expect(merged.borderColor).toBe("#fff");
    expect(merged.paddingTop).toBe("8px");
  });

  it("mergeVisualStyles clears margin/gap shorthands when longhands are set", () => {
    const merged = mergeVisualStyles(
      { margin: 0, gap: 16 },
      { marginTop: "24px", columnGap: "8px" },
    );
    expect(merged.margin).toBeUndefined();
    expect(merged.marginTop).toBe("24px");
    expect(merged.gap).toBeUndefined();
    expect(merged.columnGap).toBe("8px");
  });

  it("applyRootBlockStyles skips defaults when StyleModel has overrides", () => {
    const withDefaults = applyRootBlockStyles(STYLE_AUDIT_FIXTURE, {
      defaults: { fontSize: 12, color: "#000" },
    });
    expect(withDefaults.fontSize).toBe(STYLE_AUDIT_EXPECTED.fontSize);
    expect(withDefaults.color).toBe(STYLE_AUDIT_EXPECTED.color);
  });

  it("Button SSR markup includes builder backgroundColor on inner link", () => {
    const html = renderToStaticMarkup(
      React.createElement(Button, {
        label: "Audit",
        styles: STYLE_AUDIT_FIXTURE,
      }),
    );
    expect(html).toContain('class="ob-btn');
    const inline = cssFromStyles(STYLE_AUDIT_FIXTURE);
    if (inline.backgroundColor) {
      expect(html).toContain(String(inline.backgroundColor));
    }
  });

  it("Button styles.textColor beats partStyles.color", () => {
    const html = renderToStaticMarkup(
      React.createElement(Button, {
        label: "Test",
        partStyles: { color: "#ffffff", backgroundColor: "#147eff" },
        styles: { colors: { textColor: "#ff0000" } },
      }),
    );
    expect(html).toContain("color:#ff0000");
    expect(html).not.toMatch(/color:#ffffff/i);
  });

  it("Button textColor override keeps variant background", () => {
    const html = renderToStaticMarkup(
      React.createElement(Button, {
        label: "Test",
        variant: "primary",
        styles: { colors: { textColor: "#ff0000" } },
      }),
    );
    expect(html).toContain("color:#ff0000");
    expect(html).toContain("background-color:#147eff");
  });

  it("Heading uses applyRootBlockStyles path", () => {
    const html = renderToStaticMarkup(
      React.createElement(Heading, {
        text: "Audit",
        level: 2,
        styles: STYLE_AUDIT_FIXTURE,
      }),
    );
    expect(html).toContain("Audit");
    expect(html).toMatch(/padding/i);
  });

  it("Badge and FloatingCta render with audit styles without throwing", () => {
    const badgeHtml = renderToStaticMarkup(
      React.createElement(Badge, { text: "New", styles: STYLE_AUDIT_FIXTURE }),
    );
    expect(badgeHtml).toContain("New");

    const ctaHtml = renderToStaticMarkup(
      React.createElement(FloatingCta, { label: "CTA", styles: STYLE_AUDIT_FIXTURE }),
    );
    expect(ctaHtml).toContain("ob-floating-cta");
    expect(ctaHtml).toContain("CTA");
  });

  it("Image with explicit sizing uses contain so logos scale instead of crop", () => {
    const html = renderToStaticMarkup(
      React.createElement(Image, {
        imageUrl: "https://example.com/logo.png",
        altText: "Logo",
        styles: { sizing: { width: "200px", height: "33px" } },
      }),
    );
    expect(html).toContain('data-ob-authored-size');
    expect(html).toContain("object-fit:contain");
  });

  it("Image with width-only sizing keeps proportional height", () => {
    const html = renderToStaticMarkup(
      React.createElement(Image, {
        imageUrl: "https://example.com/logo.png",
        altText: "Logo",
        height: 33,
        styles: { sizing: { width: "150px" } },
      }),
    );
    expect(html).toContain("width:150px");
    expect(html).toContain("height:auto");
  });

  it("registry exposes all block types for audit page", () => {
    expect(STYLE_AUDIT_BLOCK_COUNT).toBeGreaterThanOrEqual(60);
  });

  it("cssFromStyles resolves inline styles for the active preview breakpoint", () => {
    styleBreakpointRef.current = "mobile";
    try {
      const mobile = cssFromStyles(STYLE_AUDIT_FIXTURE);
      expect(mobile.paddingTop).toBe("12px");
      expect(mobile.fontSize).toBe("14px");
      const desktop = cssFromStyles(STYLE_AUDIT_FIXTURE, { previewBreakpoint: "desktop" });
      expect(desktop.paddingTop).toBe("16px");
      expect(desktop.fontSize).toBe("18px");
    } finally {
      styleBreakpointRef.current = undefined;
    }
  });
});
