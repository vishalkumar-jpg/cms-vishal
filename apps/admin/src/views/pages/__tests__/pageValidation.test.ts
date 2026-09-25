import { describe, expect, it } from "bun:test";
import {
  PAGE_SLUG_MAX,
  PAGE_SLUG_REGEX,
  pageSeoMetaSchema,
  pageTitleSlugSchema,
  slugifyPageTitle,
} from "../lib/pageValidation";

describe("pageValidation", () => {
  it("slugifyPageTitle matches API-safe output", () => {
    expect(slugifyPageTitle("SaaS Landing")).toBe("saas-landing");
    expect(slugifyPageTitle("  --Hello--  ")).toBe("hello");
  });

  it("slugifyPageTitle does not end with a hyphen after truncation", () => {
    // 199 a's + "-b" would slice to 200 chars ending in "-"; strip trailing hyphen.
    const long = `${"a".repeat(199)}-b`;
    const slug = slugifyPageTitle(long);
    expect(slug.length <= PAGE_SLUG_MAX).toBe(true);
    expect(slug.endsWith("-")).toBe(false);
    expect(PAGE_SLUG_REGEX.test(slug)).toBe(true);
  });

  it("PAGE_SLUG_REGEX matches backend SLUG shape", () => {
    expect(PAGE_SLUG_REGEX.test("a")).toBe(true);
    expect(PAGE_SLUG_REGEX.test("home-page")).toBe(true);
    expect(PAGE_SLUG_REGEX.test("-home")).toBe(false);
    expect(PAGE_SLUG_REGEX.test("home-")).toBe(false);
    expect(PAGE_SLUG_REGEX.test("a".repeat(PAGE_SLUG_MAX))).toBe(true);
    expect(PAGE_SLUG_REGEX.test("a".repeat(PAGE_SLUG_MAX + 1))).toBe(false);
  });

  it("rejects reserved root slugs", () => {
    expect(pageTitleSlugSchema.safeParse({ title: "Blog", slug: "blog" }).success).toBe(
      false,
    );
    expect(pageTitleSlugSchema.safeParse({ title: "API", slug: "api" }).success).toBe(false);
    expect(pageTitleSlugSchema.safeParse({ title: "Collection", slug: "c" }).success).toBe(
      false,
    );
  });

  it("accepts titles after trimming and lowercases slugs", () => {
    const result = pageTitleSlugSchema.safeParse({
      title: "  Home Page  ",
      slug: "Home-Page",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Home Page");
      expect(result.data.slug).toBe("home-page");
    }
  });

  it("enforces max lengths", () => {
    expect(
      pageTitleSlugSchema.safeParse({ title: "x".repeat(301), slug: "ok" }).success,
    ).toBe(false);
    expect(
      pageTitleSlugSchema.safeParse({
        title: "Ok",
        slug: "a".repeat(PAGE_SLUG_MAX + 1),
      }).success,
    ).toBe(false);
  });
});

describe("pageSeoMetaSchema", () => {
  it("accepts empty optional fields", () => {
    expect(pageSeoMetaSchema.safeParse({}).success).toBe(true);
  });

  it("rejects meta title over 300 characters", () => {
    expect(pageSeoMetaSchema.safeParse({ title: "x".repeat(301) }).success).toBe(false);
  });

  it("rejects meta description over 500 characters", () => {
    expect(pageSeoMetaSchema.safeParse({ description: "x".repeat(501) }).success).toBe(false);
  });
});
