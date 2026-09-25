import { describe, expect, it } from "bun:test";
import { emptyLayout } from "@ob-cms/block-schema";
import { normalizePreviewLayout } from "@/views/builder/lib/normalizePreviewLayout";

describe("normalizePreviewLayout", () => {
  it("returns null for missing layout", () => {
    expect(normalizePreviewLayout(null)).toBe(null);
    expect(normalizePreviewLayout(undefined)).toBe(null);
  });

  it("migrates a valid serialized layout", () => {
    const layout = emptyLayout();
    const normalized = normalizePreviewLayout(layout);
    expect(normalized).not.toBe(null);
    expect(normalized?.root).toBe(layout.root);
  });

  it("repairs minimal payloads via migrate", () => {
    const result = normalizePreviewLayout({ invalid: true } as never);
    expect(result?.root).toBe("ROOT");
  });
});
