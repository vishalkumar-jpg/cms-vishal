import { describe, expect, test } from "bun:test";
import {
  filterHubspotPreviewByScope,
  HUBSPOT_IMPORT_SCOPES,
  HUBSPOT_PUBLISHED_STATE,
  isHubspotPreviewItemPublished,
  type HubspotPreviewItem,
} from "../hubspot-api";

const item = (publishState?: string): HubspotPreviewItem => ({
  hsId: "1",
  kind: "page",
  name: "Test",
  slug: "test",
  updatedAt: "2026-01-01",
  publishState,
});

describe("hubspot import scope filtering", () => {
  test("detects published preview items", () => {
    expect(isHubspotPreviewItemPublished(item(HUBSPOT_PUBLISHED_STATE))).toBe(true);
    expect(isHubspotPreviewItemPublished(item("DRAFT"))).toBe(false);
  });

  test("filters published-only scope", () => {
    const items = [item(HUBSPOT_PUBLISHED_STATE), item("DRAFT")];
    expect(filterHubspotPreviewByScope(items, HUBSPOT_IMPORT_SCOPES[0])).toHaveLength(1);
    expect(filterHubspotPreviewByScope(items, HUBSPOT_IMPORT_SCOPES[1])).toHaveLength(2);
  });
});
