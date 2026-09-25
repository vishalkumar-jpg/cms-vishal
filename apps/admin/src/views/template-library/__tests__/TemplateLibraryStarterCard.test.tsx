import { describe, expect, it } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { TemplateCatalogEntry } from "@/views/template-catalog/types";
import { TemplateLibraryStarterCard } from "../components/TemplateLibraryStarterCard";
import { starterCardTagLimit } from "../lib/formatLibraryMetadata";

const entry = (overrides: Partial<TemplateCatalogEntry> = {}): TemplateCatalogEntry => ({
  id: "tsk_compact",
  templateKey: "tpl-compact",
  displayName: "Compact Card",
  description: "Featured shelf card",
  category: "marketing",
  supportedPageTypes: ["landing"],
  tags: ["alpha", "beta", "gamma", "delta"],
  version: "1.0.0",
  status: "published",
  createdAt: "2026-08-03T00:00:00.000Z",
  updatedAt: "2026-08-03T00:00:00.000Z",
  ...overrides,
});

describe("TemplateLibraryStarterCard compact shelf", () => {
  it("uses a compact tag limit of 2 at the call site", () => {
    expect(starterCardTagLimit(true)).toBe(2);
    expect(starterCardTagLimit(false)).toBe(3);
  });

  it("renders two visible tags and an overflow badge when compact", () => {
    const html = renderToStaticMarkup(
      <TemplateLibraryStarterCard entry={entry()} compact />,
    );

    expect(html.includes("alpha")).toBe(true);
    expect(html.includes("beta")).toBe(true);
    expect(html.includes("gamma")).toBe(false);
    expect(html.includes("delta")).toBe(false);
    expect(html.includes("+2")).toBe(true);
    expect(html.includes('data-testid="template-thumbnail"')).toBe(true);
  });
});
