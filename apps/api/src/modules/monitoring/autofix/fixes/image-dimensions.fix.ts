import type { NodeMap, SerializedLayout } from "@ob-cms/block-schema";
import type { AutoFix, FixChange } from "../types";

/**
 * `unsized-images` — an `<img>` with no width/height reserves no space, so the
 * page reflows when it loads (layout shift / CLS). The Image block already
 * captures the source's intrinsic pixel size at pick time (`intrinsicWidth` /
 * `intrinsicHeight`); when the authored `width`/`height` are missing we can
 * safely backfill them from those intrinsics. Images without captured
 * intrinsics can't be sized without fetching the asset, so they're left alone
 * (surfaced as a manual follow-up).
 */

const isSet = (v: unknown): boolean => v !== undefined && v !== null && v !== "";

const positiveInt = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null;

export const imageDimensionsFix: AutoFix = {
  ruleId: "unsized-images",
  category: "one_click",
  title: "Set explicit image dimensions",
  description:
    "Add width & height to images that have known intrinsic dimensions so the browser reserves space and avoids layout shift (CLS).",

  plan(layout: SerializedLayout) {
    const changes: FixChange[] = [];
    const nextNodes: NodeMap = { ...layout.nodes };

    for (const [id, node] of Object.entries(layout.nodes)) {
      if (node.type?.resolvedName !== "Image") continue;
      const props = (node.props ?? {}) as Record<string, unknown>;
      const iw = positiveInt(props.intrinsicWidth);
      const ih = positiveInt(props.intrinsicHeight);
      if (iw === null || ih === null) continue;

      const needsW = !isSet(props.width);
      const needsH = !isSet(props.height);
      if (!needsW && !needsH) continue;

      const nextProps = { ...props };
      if (needsW) {
        changes.push({ nodeId: id, field: "width", before: props.width ?? null, after: iw, summary: `Set width=${iw}px on Image` });
        nextProps.width = iw;
      }
      if (needsH) {
        changes.push({ nodeId: id, field: "height", before: props.height ?? null, after: ih, summary: `Set height=${ih}px on Image` });
        nextProps.height = ih;
      }
      nextNodes[id] = { ...node, props: nextProps };
    }

    return changes.length ? { changes, layout: { ...layout, nodes: nextNodes } } : { changes, layout };
  },
};
