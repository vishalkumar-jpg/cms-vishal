import { describe, expect, it } from "bun:test";
import { HUBSPOT_IMPORT_SCOPES } from "@ob-cms/block-schema";
import {
  HUBSPOT_IMPORT_SCOPE_DESCRIPTIONS,
  HUBSPOT_IMPORT_SCOPE_LABELS,
} from "../constants";

describe("Import scope dialog options", () => {
  it("maps every HubSpot import scope to admin labels and descriptions", () => {
    expect(HUBSPOT_IMPORT_SCOPES).toEqual(["published", "all"]);
    for (const scope of HUBSPOT_IMPORT_SCOPES) {
      expect(HUBSPOT_IMPORT_SCOPE_LABELS[scope]?.length).toBeGreaterThan(0);
      expect(HUBSPOT_IMPORT_SCOPE_DESCRIPTIONS[scope]?.length).toBeGreaterThan(0);
    }
  });
});
