import { describe, expect, it } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TemplateLibraryPageHeader } from "../components/TemplateLibraryPageHeader";
import {
  TEMPLATE_LIBRARY_CREATE_BLANK_PAGE_LABEL,
  TEMPLATE_LIBRARY_OPEN_BUILDER_LABEL,
} from "../constants";

describe("TemplateLibraryPageHeader", () => {
  it("shows create blank page on the starter tab", () => {
    const html = renderToStaticMarkup(
      <TemplateLibraryPageHeader
        activeTab="starter"
        siteSelected
        onCreateBlankPage={() => undefined}
        onOpenBuilder={() => undefined}
      />,
    );

    expect(html.includes(TEMPLATE_LIBRARY_CREATE_BLANK_PAGE_LABEL)).toBe(true);
    expect(html.includes(TEMPLATE_LIBRARY_OPEN_BUILDER_LABEL)).toBe(false);
  });

  it("shows open builder on the mine tab", () => {
    const html = renderToStaticMarkup(
      <TemplateLibraryPageHeader
        activeTab="mine"
        siteSelected
        onCreateBlankPage={() => undefined}
        onOpenBuilder={() => undefined}
      />,
    );

    expect(html.includes(TEMPLATE_LIBRARY_OPEN_BUILDER_LABEL)).toBe(true);
    expect(html.includes(TEMPLATE_LIBRARY_CREATE_BLANK_PAGE_LABEL)).toBe(false);
  });

  it("hides actions when no site is selected", () => {
    const html = renderToStaticMarkup(
      <TemplateLibraryPageHeader
        activeTab="starter"
        siteSelected={false}
        onCreateBlankPage={() => undefined}
        onOpenBuilder={() => undefined}
      />,
    );

    expect(html.includes(TEMPLATE_LIBRARY_CREATE_BLANK_PAGE_LABEL)).toBe(false);
    expect(html.includes(TEMPLATE_LIBRARY_OPEN_BUILDER_LABEL)).toBe(false);
  });
});
