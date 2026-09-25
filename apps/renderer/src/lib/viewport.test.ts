import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rendererAppDir = join(import.meta.dirname, "..", "app");

describe("renderer viewport metadata", () => {
  it("root layout exports viewport with device-width + initial-scale", () => {
    const layoutSource = readFileSync(join(rendererAppDir, "layout.tsx"), "utf-8");
    expect(layoutSource).toContain("Viewport");
    expect(layoutSource).toMatch(/viewport:\s*Viewport\s*=/);
    expect(layoutSource).toContain('width: "device-width"');
    expect(layoutSource).toContain("initialScale: 1");
  });

  it("preview page does not redeclare a conflicting viewport export", () => {
    const previewSource = readFileSync(
      join(rendererAppDir, "%5F%5Fpreview", "[type]", "[id]", "page.tsx"),
      "utf-8",
    );
    expect(previewSource).not.toMatch(/export\s+const\s+viewport/);
  });

  it("preview page route uses PublishedPageFrame for full pages", () => {
    const previewSource = readFileSync(
      join(rendererAppDir, "%5F%5Fpreview", "[type]", "[id]", "page.tsx"),
      "utf-8",
    );
    expect(previewSource).toContain("PublishedPageFrame");
  });
});
