import { describe, expect, it } from "bun:test";
import { readPageProvenance } from "../lib/pageProvenance";

describe("readPageProvenance", () => {
  it("returns provenance when all fields are present", () => {
    expect(
      readPageProvenance({
        sourceTemplateId: "tsk_1",
        sourceTemplateKey: "tpl-marketing-homepage",
        sourceTemplateVersion: "1.0.0",
        instantiatedAt: "2026-08-03T12:00:00.000Z",
      }),
    ).toEqual({
      sourceTemplateId: "tsk_1",
      sourceTemplateKey: "tpl-marketing-homepage",
      sourceTemplateVersion: "1.0.0",
      instantiatedAt: "2026-08-03T12:00:00.000Z",
    });
  });

  it("returns null when any provenance field is missing", () => {
    expect(
      readPageProvenance({
        sourceTemplateId: "tsk_1",
        sourceTemplateKey: "tpl-marketing-homepage",
        sourceTemplateVersion: "1.0.0",
        instantiatedAt: null,
      }),
    ).toBe(null);
    expect(readPageProvenance(null)).toBe(null);
  });
});
