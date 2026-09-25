import { describe, expect, it } from "bun:test";
import {
  builderPathForPage,
  canProceedFromPreviewToUse,
} from "../lib/catalogFlow";
import {
  canUseTemplate,
  closePreviewDialog,
  openPreviewDialog,
} from "../lib/templatePreview";
import type { TemplateCatalogEntry } from "../types";

const published: TemplateCatalogEntry = {
  id: "tsk_1",
  templateKey: "tpl-blank",
  displayName: "Blank Page",
  description: "Empty",
  category: "utility",
  supportedPageTypes: ["generic-content"],
  tags: [],
  version: "1.0.0",
  status: "published",
  createdAt: "2026-08-03T00:00:00.000Z",
  updatedAt: "2026-08-03T00:00:00.000Z",
};

const draft: TemplateCatalogEntry = { ...published, id: "tsk_2", status: "draft" };

describe("catalog integration flow helpers", () => {
  it("Preview → Use Template is allowed only for published templates", () => {
    const preview = openPreviewDialog(published);
    expect(preview.open).toBe(true);
    expect(preview.template?.id).toBe("tsk_1");
    expect(canProceedFromPreviewToUse(preview.template)).toBe(true);

    const draftPreview = openPreviewDialog(draft);
    expect(canProceedFromPreviewToUse(draftPreview.template)).toBe(false);
    expect(canUseTemplate("archived")).toBe(false);
  });

  it("closing preview clears the selected template", () => {
    expect(closePreviewDialog()).toEqual({ open: false, template: null });
  });

  it("builder navigation path matches create-from-template success route", () => {
    expect(builderPathForPage("pag_abc")).toBe("/pages/pag_abc/builder");
  });

  it("disabled draft templates cannot proceed to Use Template", () => {
    expect(canProceedFromPreviewToUse(draft)).toBe(false);
    expect(canProceedFromPreviewToUse(null)).toBe(false);
  });
});
