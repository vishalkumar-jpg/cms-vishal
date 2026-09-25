import { describe, expect, it, mock } from "bun:test";
import { emptyLayout } from "@ob-cms/block-schema";
import {
  prefetchStarterSectionSkeleton,
  type StarterSectionSkeletonFetch,
} from "../starterSectionSkeletonPrefetch";

describe("prefetchStarterSectionSkeleton", () => {
  it("caches successful prefetches and clears prior failure markers", async () => {
    const fetchedKeys = new Set<string>();
    const layout = emptyLayout();
    const fetch = mock<StarterSectionSkeletonFetch>(async () => ({ content: { layout } }));

    const first = await prefetchStarterSectionSkeleton("tpl-test", fetchedKeys, fetch);
    expect(first).toEqual({ status: "success", layout });
    expect(fetchedKeys.has("tpl-test")).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);

    const second = await prefetchStarterSectionSkeleton("tpl-test", fetchedKeys, fetch);
    expect(second).toEqual({ status: "skipped" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("removes failed keys so a later retry can fetch again", async () => {
    const fetchedKeys = new Set<string>();
    const fetch = mock<StarterSectionSkeletonFetch>(async () => {
      throw new Error("network");
    });

    const failed = await prefetchStarterSectionSkeleton("tpl-test", fetchedKeys, fetch);
    expect(failed).toEqual({ status: "failed" });
    expect(fetchedKeys.has("tpl-test")).toBe(false);

    const layout = emptyLayout();
    fetch.mockImplementation(async () => ({ content: { layout } }));

    const retry = await prefetchStarterSectionSkeleton("tpl-test", fetchedKeys, fetch);
    expect(retry).toEqual({ status: "success", layout });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
