import { describe, expect, it } from "bun:test";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";

describe("useTemplateSkeleton query keys", () => {
  it("uses a dedicated cache bucket for skeleton layout fetches", () => {
    expect(ADMIN_QUERY_KEYS.TEMPLATE_SKELETON).toBe("template-skeleton");
  });
});
