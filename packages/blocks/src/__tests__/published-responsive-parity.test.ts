import { describe, it, expect } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Heading } from "../blocks/content";
import { Row, Column } from "../blocks/layout";
import { OBViewportProvider } from "../viewport-context";
import { cssFromStyles, authoredLayoutAttr } from "../lib";
import { styleBreakpointRef } from "../style-breakpoint-context";

/** Hero-like styles: desktop row + explicit mobile column + mobile typography. */
const SPLIT_ROW_STYLES = {
  layout: { display: "flex", flexDirection: "row" },
  responsive: { mobile: { layout: { flexDirection: "column" } } },
};

const HERO_HEADING_STYLES = {
  typography: { fontSize: "48px", letterSpacing: "0px" },
  responsive: {
    mobile: { typography: { fontSize: "35px", letterSpacing: "0.5px" } },
    tablet: { typography: { fontSize: "41px" } },
  },
};

describe("published responsive parity (mobile breakpoint context)", () => {
  it("cssFromStyles uses explicit mobile typography instead of desktop fluid clamp", () => {
    styleBreakpointRef.current = "mobile";
    try {
      const mobile = cssFromStyles(HERO_HEADING_STYLES);
      expect(mobile.fontSize).toBe("35px");
      expect(mobile.letterSpacing).toBe("0.5px");
      expect(String(mobile.fontSize)).not.toContain("clamp");
    } finally {
      styleBreakpointRef.current = undefined;
    }
  });

  it("authoredLayoutAttr does not pin desktop row when mobile breakpoint is active", () => {
    styleBreakpointRef.current = "mobile";
    try {
      const resolved = cssFromStyles(SPLIT_ROW_STYLES);
      const attrs = authoredLayoutAttr(SPLIT_ROW_STYLES, resolved);
      expect(attrs["data-ob-keep-row"]).toBeUndefined();
      expect(resolved.flexDirection).toBe("column");
    } finally {
      styleBreakpointRef.current = undefined;
    }
  });

  it("without breakpoint context, desktop row is incorrectly pinned on mobile layer", () => {
    styleBreakpointRef.current = undefined;
    const resolved = cssFromStyles(SPLIT_ROW_STYLES);
    const attrs = authoredLayoutAttr(SPLIT_ROW_STYLES, resolved);
    expect(attrs["data-ob-keep-row"]).toBe("");
    expect(resolved.flexDirection).toBe("row");
  });

  it("Row stacks split-row layout on mobile when viewport + breakpoint are set", () => {
    styleBreakpointRef.current = "mobile";
    try {
      const html = renderToStaticMarkup(
        React.createElement(
          OBViewportProvider,
          { value: "mobile" },
          React.createElement(
            Row,
            { styles: SPLIT_ROW_STYLES, className: "ob-split-row" },
            React.createElement(Column, { key: "a" }, "Copy"),
            React.createElement(Column, { key: "b" }, "Image"),
          ),
        ),
      );
      expect(html).toContain('flex-direction:column');
      expect(html).not.toContain("data-ob-keep-row");
    } finally {
      styleBreakpointRef.current = undefined;
    }
  });

  it("Heading renders mobile font size when breakpoint context is mobile", () => {
    styleBreakpointRef.current = "mobile";
    try {
      const html = renderToStaticMarkup(
        React.createElement(
          OBViewportProvider,
          { value: "mobile" },
          React.createElement(Heading, {
            text: "Remote Staffing",
            level: 1,
            styles: HERO_HEADING_STYLES,
          }),
        ),
      );
      expect(html).toContain("font-size:35px");
      expect(html).not.toContain("clamp(");
    } finally {
      styleBreakpointRef.current = undefined;
    }
  });
});
