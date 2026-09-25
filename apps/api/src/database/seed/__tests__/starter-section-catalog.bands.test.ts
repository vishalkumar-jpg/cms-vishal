import { describe, expect, test } from "bun:test";
import { STARTER_SECTION_BANDS } from "@ob-cms/shared";
import { STARTER_LAYOUT_BUILDERS } from "../starter-layouts";

function topLevelBandIds(layout: Record<string, unknown>): string[] {
  const nodes = layout.nodes as Record<string, { nodes?: string[] }>;
  const root = layout.root as string;
  return nodes[root]?.nodes ?? [];
}

describe("starter section catalog band indices", () => {
  test("shared starter section bands match catalog length", () => {
    expect(STARTER_SECTION_BANDS.length).toBe(21);
  });

  test("every catalog band index resolves in seeded starter layouts", () => {
    for (const { templateKey, bandIndex } of STARTER_SECTION_BANDS) {
      const builder = STARTER_LAYOUT_BUILDERS[templateKey];
      if (!builder) {
        throw new Error(`Missing starter layout builder: ${templateKey}`);
      }
      const layout = builder();
      const bandIds = topLevelBandIds(layout);
      expect(bandIds.length).toBeGreaterThan(bandIndex);
      expect(typeof bandIds[bandIndex]).toBe("string");
    }
  });
});
