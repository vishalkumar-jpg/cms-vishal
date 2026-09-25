import { describe, expect, it } from "bun:test";
import type { TemplateCatalogEntry } from "../types";
import {
  canUseTemplate,
  closePreviewDialog,
  hasPreviewTags,
  hasPreviewThumbnail,
  openPreviewDialog,
  PREVIEW_DESCRIPTION_FALLBACK,
  previewCoverUrl,
  previewDescription,
  previewThumbnailUrl,
} from "../lib/templatePreview";

const entry = (overrides: Partial<TemplateCatalogEntry> = {}): TemplateCatalogEntry => ({
  id: "tsk_1",
  templateKey: "tpl-saas-landing",
  displayName: "SaaS Landing",
  description: "A marketing landing page",
  category: "marketing",
  supportedPageTypes: ["landing"],
  tags: ["saas", "hero"],
  version: "1.0.0",
  status: "published",
  createdAt: "2026-08-03T00:00:00.000Z",
  updatedAt: "2026-08-03T00:00:00.000Z",
  ...overrides,
});

describe("canUseTemplate", () => {
  it("enables Use Template for published templates", () => {
    expect(canUseTemplate("published")).toBe(true);
  });

  it("disables Use Template for draft and archived templates", () => {
    expect(canUseTemplate("draft")).toBe(false);
    expect(canUseTemplate("archived")).toBe(false);
  });
});

describe("preview dialog open/close", () => {
  it("opens with the selected template", () => {
    const template = entry();
    expect(openPreviewDialog(template)).toEqual({ open: true, template });
  });

  it("closes and clears the template", () => {
    expect(closePreviewDialog()).toEqual({ open: false, template: null });
  });
});

describe("preview display helpers", () => {
  it("falls back when description is missing or blank", () => {
    expect(previewDescription("")).toBe(PREVIEW_DESCRIPTION_FALLBACK);
    expect(previewDescription("   ")).toBe(PREVIEW_DESCRIPTION_FALLBACK);
    expect(previewDescription(undefined)).toBe(PREVIEW_DESCRIPTION_FALLBACK);
  });

  it("keeps a non-empty description", () => {
    expect(previewDescription("  Hello  ")).toBe("Hello");
  });

  it("hides tags when empty", () => {
    expect(hasPreviewTags([])).toBe(false);
    expect(hasPreviewTags(undefined)).toBe(false);
    expect(hasPreviewTags(["saas"])).toBe(true);
  });

  it("treats missing thumbnail as fallback placeholder", () => {
    expect(hasPreviewThumbnail(undefined)).toBe(false);
    expect(hasPreviewThumbnail("")).toBe(false);
    expect(hasPreviewThumbnail("/templates/previews/tpl-blank-thumb.svg")).toBe(true);
  });

  it("resolves convention-based preview asset URLs", () => {
    expect(previewCoverUrl("tpl-saas-landing")).toBe(
      "/templates/previews/tpl-saas-landing-cover.svg",
    );
    expect(previewThumbnailUrl(entry({ thumbnail: undefined }))).toBe(
      "/templates/previews/tpl-saas-landing-thumb.svg",
    );
    expect(previewThumbnailUrl(entry({ thumbnail: "/custom/thumb.svg" }))).toBe(
      "/custom/thumb.svg",
    );
  });
});
