import { describe, expect, it } from "bun:test";
import type { CollectionField } from "@/views/collections/types";
import type { CollectionDetailBuilderContextValue } from "../../collection-detail/CollectionDetailBuilderContext";
import { resolveBindableFields } from "../resolveBindableFields";

const FIELDS: CollectionField[] = [
  { key: "title", label: "Title", type: "text" },
  { key: "description", label: "Description", type: "richtext" },
];

const COLLECTIONS: Array<{ slug: string; fields: CollectionField[] }> = [
  { slug: "articles", fields: FIELDS },
  { slug: "team", fields: [{ key: "name", label: "Name", type: "text" }] },
];

const DETAIL_CONTEXT: CollectionDetailBuilderContextValue = {
  collectionId: "col_1",
  collectionSlug: "articles",
  fields: FIELDS,
};

describe("resolveBindableFields", () => {
  it("returns collection fields when Collection Detail context is active", () => {
    expect(resolveBindableFields(DETAIL_CONTEXT, null, COLLECTIONS)).toEqual(FIELDS);
  });

  it("returns root detail fields even when a Repeater slug is present", () => {
    expect(resolveBindableFields(DETAIL_CONTEXT, "team", COLLECTIONS)).toEqual(FIELDS);
  });

  it("returns empty array when detail context has no fields", () => {
    expect(
      resolveBindableFields(
        { collectionId: "col_1", collectionSlug: "articles", fields: [] },
        "team",
        COLLECTIONS,
      ),
    ).toEqual([]);
  });

  it("falls back to Repeater collection fields when detail context is absent", () => {
    expect(resolveBindableFields(null, "team", COLLECTIONS)).toEqual([
      { key: "name", label: "Name", type: "text" },
    ]);
  });

  it("returns empty array when neither detail context nor Repeater applies", () => {
    expect(resolveBindableFields(null, null, COLLECTIONS)).toEqual([]);
  });

  it("returns empty array for unknown Repeater slug", () => {
    expect(resolveBindableFields(null, "missing", COLLECTIONS)).toEqual([]);
  });
});
