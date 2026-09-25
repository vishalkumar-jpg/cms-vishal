import { describe, it, expect } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Row, Column, Div } from "../blocks/layout";
import { Icon } from "../blocks/icon";
import { Paragraph } from "../blocks/content";
import { OBViewportProvider } from "../viewport-context";
import {
  shouldStackRowOnNarrow,
  authoredLayoutAttr,
  hasNarrowKeepRowOverride,
} from "../lib";
import { styleBreakpointRef } from "../style-breakpoint-context";

describe("mobile row/column layout control", () => {
  it("shouldStackRowOnNarrow respects explicit mobile flexDirection row", () => {
    const styles = {
      layout: { flexDirection: "row" },
      responsive: { mobile: { layout: { flexDirection: "row" } } },
    };
    styleBreakpointRef.current = "mobile";
    try {
      expect(shouldStackRowOnNarrow(styles, { flexDirection: "row" })).toBe(false);
      expect(shouldStackRowOnNarrow(styles, { flexDirection: "column" })).toBe(true);
    } finally {
      styleBreakpointRef.current = undefined;
    }
  });

  it("hasNarrowKeepRowOverride detects mobile row pin for live site", () => {
    expect(
      hasNarrowKeepRowOverride({
        responsive: { mobile: { layout: { flexDirection: "row" } } },
      }),
    ).toBe(true);
    expect(
      hasNarrowKeepRowOverride({
        responsive: { mobile: { layout: { flexDirection: "column" } } },
      }),
    ).toBe(false);
  });

  it("authoredLayoutAttr adds data-ob-keep-row on live site when mobile row is pinned", () => {
    const attrs = authoredLayoutAttr(
      { responsive: { mobile: { layout: { flexDirection: "row" } } } },
      { flexDirection: "row" },
      "mobile",
    );
    expect(attrs["data-ob-keep-row"]).toBe("");
    expect(attrs["data-ob-authored-layout"]).toBe("");
  });

  it("authoredLayoutAttr does not pin inherited desktop row on mobile", () => {
    const attrs = authoredLayoutAttr(
      { layout: { flexDirection: "row" } },
      { flexDirection: "row" },
      "mobile",
    );
    expect(attrs["data-ob-keep-row"]).toBeUndefined();
  });

  it("Row keeps horizontal layout on mobile when flexDirection row is set", () => {
    const styles = {
      responsive: { mobile: { layout: { flexDirection: "row", gap: "8px" } } },
    };
    styleBreakpointRef.current = "mobile";
    try {
      const html = renderToStaticMarkup(
        React.createElement(
          OBViewportProvider,
          { value: "mobile" },
          React.createElement(
            Row,
            { styles },
            React.createElement(Column, { key: "a" }, "Icon"),
            React.createElement(Column, { key: "b" }, "Training built into every engagement"),
          ),
        ),
      );
      expect(html).toContain("data-ob-authored-layout");
      expect(html).toContain("data-ob-keep-row");
      expect(html).toContain("flex-direction:row");
      expect(html).not.toContain('flex-direction:column');
    } finally {
      styleBreakpointRef.current = undefined;
    }
  });

  it("Div keeps horizontal layout on mobile when flexDirection row is set at mobile", () => {
    const styles = {
      layout: { display: "flex", alignItems: "center" },
      responsive: { mobile: { layout: { flexDirection: "row" } } },
    };
    styleBreakpointRef.current = "mobile";
    try {
      const html = renderToStaticMarkup(
        React.createElement(
          OBViewportProvider,
          { value: "mobile" },
          React.createElement(Div, { styles }, ">", "Training built into every engagement"),
        ),
      );
      expect(html).toContain("data-ob-keep-row");
      expect(html).toContain("flex-direction:row");
      expect(html).not.toContain('flex-direction:column');
    } finally {
      styleBreakpointRef.current = undefined;
    }
  });

  it("Row keeps horizontal layout on mobile when flexWrap is nowrap", () => {
    const styles = {
      layout: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "nowrap",
        alignItems: "flex-start",
      },
      spacing: { gap: 12 },
    };
    styleBreakpointRef.current = "mobile";
    try {
      const html = renderToStaticMarkup(
        React.createElement(
          OBViewportProvider,
          { value: "mobile" },
          React.createElement(
            Row,
            { styles },
            React.createElement(Column, { key: "a" }, "Icon"),
            React.createElement(Column, { key: "b" }, "Training built into every engagement"),
          ),
        ),
      );
      expect(html).toContain("data-ob-keep-row");
      expect(html).toContain("flex-direction:row");
      expect(html).not.toContain('flex-direction:column');
    } finally {
      styleBreakpointRef.current = undefined;
    }
  });

  it("Row with icon+text (no Column children) stays horizontal on mobile without ob-keep-row", () => {
    const styles = {
      layout: { display: "flex", flexDirection: "row", alignItems: "flex-start" },
      spacing: { gap: 12 },
    };
    styleBreakpointRef.current = "mobile";
    try {
      const html = renderToStaticMarkup(
        React.createElement(
          OBViewportProvider,
          { value: "mobile" },
          React.createElement(
            Row,
            { styles },
            React.createElement(Icon, { name: "ChevronRight", size: 18, color: "#147eff" }),
            React.createElement(Paragraph, { text: "Training built into every engagement" }),
          ),
        ),
      );
      expect(html).toContain("flex-direction:row");
      expect(html).not.toContain("flex-direction:column");
    } finally {
      styleBreakpointRef.current = undefined;
    }
  });

  it("Row stacks on mobile by default without an explicit override", () => {
    styleBreakpointRef.current = "mobile";
    try {
      const html = renderToStaticMarkup(
        React.createElement(
          OBViewportProvider,
          { value: "mobile" },
          React.createElement(
            Row,
            { styles: { layout: { flexDirection: "row" } } },
            React.createElement(Column, { key: "a" }, "A"),
            React.createElement(Column, { key: "b" }, "B"),
          ),
        ),
      );
      expect(html).toContain('flex-direction:column');
      expect(html).not.toContain("data-ob-keep-row");
    } finally {
      styleBreakpointRef.current = undefined;
    }
  });
});
