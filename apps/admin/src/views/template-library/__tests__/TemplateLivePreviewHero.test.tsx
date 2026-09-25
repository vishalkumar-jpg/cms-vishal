import { describe, expect, it } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyLayout } from "@ob-cms/block-schema";
import { TemplateLivePreviewHero } from "../components/TemplateLivePreviewHero";
import { TemplateThumbnail } from "../components/TemplateThumbnail";

describe("TemplateLivePreviewHero", () => {
  it("renders an eager live preview thumbnail frame", () => {
    const html = renderToStaticMarkup(
      <TemplateLivePreviewHero layout={emptyLayout()} mineKind="page" label="Mine preview" />,
    );

    expect(html.includes('data-testid="template-thumbnail"')).toBe(true);
    expect(html.includes('data-testid="layout-preview-pane"')).toBe(true);
    expect(html.includes('data-readonly="true"')).toBe(true);
  });
});

describe("TemplateThumbnail", () => {
  it("renders starter SVG placeholder before viewport activation", () => {
    const html = renderToStaticMarkup(
      <TemplateThumbnail
        label="Card preview"
        templateKey="tpl-home"
        starterEntry={{ templateKey: "tpl-home", thumbnail: undefined }}
      />,
    );

    expect(html.includes('data-testid="template-thumbnail"')).toBe(true);
    expect(html.includes("/templates/previews/tpl-home-thumb.svg")).toBe(true);
  });

  it("renders mine kind placeholder before viewport activation", () => {
    const html = renderToStaticMarkup(
      <TemplateThumbnail
        label="Mine preview"
        layout={emptyLayout()}
        mineKind="section"
      />,
    );

    expect(html.includes("Section")).toBe(true);
    expect(html.includes("Saved layout")).toBe(true);
  });
});
