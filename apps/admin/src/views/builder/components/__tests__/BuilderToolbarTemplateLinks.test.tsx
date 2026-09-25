import { describe, expect, it } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SerializedLayout } from "@ob-cms/block-schema";
import { emptyLayout } from "@ob-cms/block-schema";
import { BuilderToolbarTemplateNavLinks } from "../BuilderToolbarTemplateMenuLinks";
import { LayoutPreviewRenderer } from "../LayoutPreviewRenderer";
import { LayoutPreviewPane } from "../LayoutPreviewPane";
import {
  MY_TEMPLATES_TAB_LABEL,
  TEMPLATE_LIBRARY_BROWSE_STARTERS_LABEL,
  TEMPLATE_LIBRARY_ROUTES,
} from "@/views/template-library/constants";

const layoutWithButton = (): SerializedLayout => {
  const base = emptyLayout();
  return {
    ...base,
    nodes: {
      ...base.nodes,
      btn1: {
        type: { resolvedName: "Button" },
        isCanvas: false,
        props: { label: "Click me", href: "https://example.com" },
        displayName: "Button",
        custom: {},
        parent: base.root,
        hidden: false,
        nodes: [],
        linkedNodes: {},
      },
      [base.root]: {
        ...base.nodes[base.root],
        nodes: ["btn1"],
      },
    },
  };
};

describe("BuilderToolbarTemplateNavLinks", () => {
  it("renders router links to My Templates and Browse Starter Templates", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <BuilderToolbarTemplateNavLinks />
      </MemoryRouter>,
    );

    expect(html.includes(MY_TEMPLATES_TAB_LABEL)).toBe(true);
    expect(html.includes(TEMPLATE_LIBRARY_BROWSE_STARTERS_LABEL)).toBe(true);
    expect(html.includes(`href="${TEMPLATE_LIBRARY_ROUTES.mine}"`)).toBe(true);
    expect(html.includes(`href="${TEMPLATE_LIBRARY_ROUTES.starters}"`)).toBe(true);
  });
});

describe("LayoutPreviewPane read-only guard", () => {
  it("wraps the scaled preview in an inert subtree with an accessible label", () => {
    const html = renderToStaticMarkup(
      <LayoutPreviewPane layout={emptyLayout()} label="Template preview" />,
    );

    expect(html.includes("inert")).toBe(true);
    expect(html.includes('role="img"')).toBe(true);
    expect(html.includes('aria-label="Template preview"')).toBe(true);
  });
});

describe("LayoutPreviewRenderer read-only guard", () => {
  it("renders interactive blocks inside an inert subtree", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <LayoutPreviewRenderer layout={layoutWithButton()} />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(html.includes("inert")).toBe(true);
    expect(html.includes('data-testid="layout-preview-renderer"')).toBe(true);
  });
});
