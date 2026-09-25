import { describe, expect, it } from "bun:test";
import { slugify } from "../lib/slugify";

describe("slugify", () => {
  it("lowercases and hyphenates titles", () => {
    expect(slugify("SaaS Landing")).toBe("saas-landing");
  });

  it("trims leading and trailing separators", () => {
    expect(slugify("  --Hello World--  ")).toBe("hello-world");
  });

  it("collapses non-alphanumeric runs", () => {
    expect(slugify("Contact / Inquiry!!")).toBe("contact-inquiry");
  });
});
