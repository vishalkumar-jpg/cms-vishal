import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("navbar mobile CTA CSS parity", () => {
  it("does not force legacy header CTA visible in base navbar rules", () => {
    const css = readFileSync(
      join(import.meta.dirname, "..", "..", "..", "..", "packages", "blocks", "src", "blocks.css"),
      "utf-8",
    );

    expect(css).toContain(
      '.cms-navbar.site-header__nav .ob-nav-cta-bar {\n  grid-area: actions;\n  flex-shrink: 0;\n  min-width: 0;\n}',
    );
    expect(css).toContain(
      '.ob-site .ob-nav-root[data-nav-mode="legacy"] .ob-nav-cta-bar {\n  grid-area: actions;\n  flex-shrink: 0;\n}',
    );
    expect(css).toContain("@container ob (max-width: 767px)");
    expect(css).toMatch(
      /@container ob \(max-width: 767px\)[\s\S]*\.ob-site \.cms-navbar \.ob-nav-cta-bar[\s\S]*display: none !important;/,
    );
  });
});
