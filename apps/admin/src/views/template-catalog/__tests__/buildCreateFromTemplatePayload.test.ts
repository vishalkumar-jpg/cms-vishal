import { describe, expect, it } from "bun:test";
import { buildCreateFromTemplatePayload } from "../lib/buildCreateFromTemplatePayload";

describe("buildCreateFromTemplatePayload", () => {
  const base = {
    title: "Campaign Landing",
    slug: "campaign-landing",
    skeletonId: "tsk_test",
  };

  it("returns title, slug, and skeletonId only by default", () => {
    expect(buildCreateFromTemplatePayload(base)).toEqual(base);
  });

  it("includes parentId when set", () => {
    expect(
      buildCreateFromTemplatePayload({ ...base, parentId: "pg_parent" }),
    ).toEqual({ ...base, parentId: "pg_parent" });
  });

  it("omits parentId when empty", () => {
    expect(buildCreateFromTemplatePayload({ ...base, parentId: "" })).toEqual(base);
  });

  it("includes seo when meta title or description is provided", () => {
    expect(
      buildCreateFromTemplatePayload({
        ...base,
        seoTitle: " SEO title ",
        seoDescription: "Description",
      }),
    ).toEqual({
      ...base,
      seo: { title: "SEO title", description: "Description" },
    });
  });

  it("omits seo when both fields are blank", () => {
    expect(
      buildCreateFromTemplatePayload({ ...base, seoTitle: "  ", seoDescription: "" }),
    ).toEqual(base);
  });

  it("includes partial seo when only one field is set", () => {
    expect(buildCreateFromTemplatePayload({ ...base, seoDescription: "Only desc" })).toEqual({
      ...base,
      seo: { description: "Only desc" },
    });
  });
});
