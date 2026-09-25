import { describe, expect, it } from "bun:test";
import { usageCountByTemplateKey } from "../hooks/useTemplateSkeletonUsage";

describe("usageCountByTemplateKey", () => {
  it("maps template keys to total page counts", () => {
    const map = usageCountByTemplateKey([
      { skeletonId: "tsk_a", templateKey: "tpl-a", totalPages: 18, lastUsedAt: null },
      { skeletonId: "tsk_b", templateKey: "tpl-b", totalPages: 2, lastUsedAt: null },
    ]);
    expect(map.get("tpl-a")).toBe(18);
    expect(map.get("tpl-b")).toBe(2);
    expect(map.get("tpl-missing")).toEqual(undefined);
  });
});
