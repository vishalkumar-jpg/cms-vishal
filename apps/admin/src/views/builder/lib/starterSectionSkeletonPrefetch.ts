import type { SerializedLayout } from "@ob-cms/block-schema";

export type StarterSectionSkeletonFetch = (
  templateKey: string,
) => Promise<{ content: { layout: SerializedLayout } }>;

/** Prefetch one starter skeleton; remove the key from fetchedKeys on failure so retries can run. */
export async function prefetchStarterSectionSkeleton(
  templateKey: string,
  fetchedKeys: Set<string>,
  fetch: StarterSectionSkeletonFetch,
): Promise<
  | { status: "success"; layout: SerializedLayout }
  | { status: "failed" }
  | { status: "skipped" }
> {
  if (fetchedKeys.has(templateKey)) return { status: "skipped" };
  fetchedKeys.add(templateKey);
  try {
    const record = await fetch(templateKey);
    return { status: "success", layout: record.content.layout };
  } catch {
    fetchedKeys.delete(templateKey);
    return { status: "failed" };
  }
}
