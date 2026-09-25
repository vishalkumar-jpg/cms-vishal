import type { SerializedLayout } from "@ob-cms/block-schema";

/**
 * Best-effort SEO signals sampled from a serialized layout for the SEO score
 * (gap D22). The layout is a Craft.js node map; we walk every node and read a
 * couple of well-known block props (Heading `level`, Image `imageUrl`/`altText`).
 * Tolerant of unknown blocks/shapes — anything we can't read is simply ignored.
 */
export interface LayoutSeoSignals {
  /** Number of Heading blocks rendered as an H1 (level === 1). */
  h1Count: number;
  /** Image blocks that have a source but no alt text. */
  imagesMissingAlt: number;
}

export function sampleLayoutSeo(layout: SerializedLayout | null | undefined): LayoutSeoSignals {
  const signals: LayoutSeoSignals = { h1Count: 0, imagesMissingAlt: 0 };
  if (!layout?.nodes) return signals;

  for (const node of Object.values(layout.nodes)) {
    const name = node?.type?.resolvedName;
    const props = (node?.props ?? {}) as Record<string, unknown>;
    if (name === "Heading") {
      const level = Number(props.level ?? 2);
      if (level === 1) signals.h1Count++;
    } else if (name === "Image") {
      const hasSrc = typeof props.imageUrl === "string" && props.imageUrl.trim().length > 0;
      const alt = typeof props.altText === "string" ? props.altText.trim() : "";
      if (hasSrc && !alt) signals.imagesMissingAlt++;
    }
  }
  return signals;
}
