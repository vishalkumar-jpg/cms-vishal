import { describe, expect, it } from "bun:test";
import { parseTemplateLibraryTab } from "../lib/templateLibraryTab";

describe("parseTemplateLibraryTab", () => {
  it("returns valid tab values unchanged", () => {
    expect(parseTemplateLibraryTab("starter")).toBe("starter");
    expect(parseTemplateLibraryTab("mine")).toBe("mine");
  });

  it("falls back to starter for invalid tab values", () => {
    expect(parseTemplateLibraryTab(null)).toBe("starter");
    expect(parseTemplateLibraryTab(undefined)).toBe("starter");
    expect(parseTemplateLibraryTab("")).toBe("starter");
    expect(parseTemplateLibraryTab("marketplace")).toBe("starter");
  });
});
