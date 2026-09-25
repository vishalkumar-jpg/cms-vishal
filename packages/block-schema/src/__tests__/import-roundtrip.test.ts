import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  importPocExport,
  serializeLayout,
  deserializeLayout,
  CURRENT_SCHEMA_VERSION,
  BLOCK_TYPES,
} from "../index";

const EXPORT_PATH = resolve(
  import.meta.dir,
  "../../../../../team-docs/reference-assets/officebeacon-homepage.poc-export.json",
);

const loadExport = () => JSON.parse(readFileSync(EXPORT_PATH, "utf8"));

describe("importPocExport on the real OB homepage export", () => {
  it("parses metadata -> seo and craft -> layout", () => {
    const { seo, layout } = importPocExport(loadExport());
    expect(layout.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(layout.root).toBe("ROOT");
    expect(Object.keys(layout.nodes).length).toBeGreaterThan(100);
    // metadata.title was "ob"
    expect(seo.title).toBe("ob");
    expect(seo).toHaveProperty("description");
    expect(seo).toHaveProperty("canonical");
    expect(seo).toHaveProperty("ogImage");
  });

  it("every node resolves to a registered block type (no unknown blocks)", () => {
    const { layout } = importPocExport(loadExport());
    const types = new Set(
      Object.values(layout.nodes).map((n) => n.type.resolvedName),
    );
    for (const t of types) {
      expect(BLOCK_TYPES).toContain(t);
    }
    // All 28 block types are exercised by the OB homepage.
    expect(types.size).toBe(28);
  });

  it("round-trips: import -> serialize -> deserialize is deep-equal stable", () => {
    const first = importPocExport(loadExport()).layout;
    const str1 = serializeLayout(first);
    const second = deserializeLayout(str1);
    const str2 = serializeLayout(second);
    // serialized strings are byte-stable
    expect(str2).toBe(str1);
    // and structurally deep-equal
    expect(second).toEqual(first);
  });
});
