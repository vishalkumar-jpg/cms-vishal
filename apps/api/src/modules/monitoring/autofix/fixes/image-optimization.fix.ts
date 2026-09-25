import type { SerializedLayout } from "@ob-cms/block-schema";
import type { AutoFix, FixChange } from "../types";

/**
 * `uses-optimized-images` / `modern-image-formats` — raster images are served
 * without compression or next-gen (WebP/AVIF) variants. This fix does NOT edit
 * the page layout; instead it names the page's raster images that still lack
 * derivatives so the service can re-encode them through the existing image
 * processing pipeline (`enqueueMediaProcess`). Applying it therefore queues
 * background work rather than writing the draft (`effect: "media-optimize"`).
 *
 * An image is a candidate when it has a real http(s) source and no `variants`
 * captured yet. SVGs, inline SVGs and data URIs are skipped — they gain nothing
 * from raster re-encoding.
 */

const RASTER_SKIP = /\.svg($|\?)/i;

const isOptimizableUrl = (url: unknown): url is string =>
  typeof url === "string" &&
  /^https?:\/\//i.test(url) &&
  !url.startsWith("data:") &&
  !RASTER_SKIP.test(url);

export const imageOptimizationFix: AutoFix = {
  ruleId: "uses-optimized-images",
  ruleIds: ["modern-image-formats"],
  category: "one_click",
  effect: "media-optimize",
  title: "Optimize images (compress + WebP)",
  description:
    "Re-encode page images that have no responsive/next-gen derivatives yet, generating compressed WebP variants through the media pipeline. The original asset is preserved; nothing on the page changes until the variants are ready.",

  plan(layout: SerializedLayout) {
    const changes: FixChange[] = [];
    const seen = new Set<string>();

    for (const [id, node] of Object.entries(layout.nodes)) {
      if (node.type?.resolvedName !== "Image") continue;
      const props = (node.props ?? {}) as Record<string, unknown>;
      if (props.inlineSvg) continue;

      const src = props.imageUrl;
      if (!isOptimizableUrl(src)) continue;

      // Already has derivatives → nothing to optimize.
      const variants = props.variants;
      if (Array.isArray(variants) && variants.length > 0) continue;

      if (seen.has(src)) continue;
      seen.add(src);

      changes.push({
        nodeId: id,
        field: "imageUrl",
        before: src,
        after: src,
        summary: `Queue WebP + responsive variants for ${src}`,
      });
    }

    // Never mutates the layout — the pixel work happens in the worker.
    return { changes, layout };
  },
};
