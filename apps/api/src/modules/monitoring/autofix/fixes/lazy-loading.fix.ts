import type { NodeMap, SerializedLayout } from "@ob-cms/block-schema";
import type { AutoFix, FixChange } from "../types";

/**
 * `offscreen-images` — images below the fold should defer loading
 * (`loading="lazy"`) so they don't compete with the initial render. We walk the
 * layout in document order and lazy-load every Image EXCEPT the first one, which
 * is the most likely above-the-fold / LCP candidate and should stay eager.
 * Images already marked `loading="lazy"` are skipped (idempotent).
 */

/** Pre-order document walk of the node tree, yielding node ids in render order. */
function walkOrder(layout: SerializedLayout): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string): void => {
    if (seen.has(id)) return;
    seen.add(id);
    const node = layout.nodes[id];
    if (!node) return;
    order.push(id);
    for (const child of node.nodes ?? []) visit(child);
    for (const linked of Object.values(node.linkedNodes ?? {})) visit(linked);
  };
  visit(layout.root);
  return order;
}

export const lazyLoadingFix: AutoFix = {
  ruleId: "offscreen-images",
  category: "automatic",
  title: "Lazy-load offscreen images",
  description:
    'Add loading="lazy" to images below the fold so they load on demand. The first image is left eager as the likely above-the-fold / LCP element.',

  plan(layout: SerializedLayout) {
    const changes: FixChange[] = [];
    const nextNodes: NodeMap = { ...layout.nodes };

    const imageIds = walkOrder(layout).filter(
      (id) => layout.nodes[id]?.type?.resolvedName === "Image",
    );

    imageIds.forEach((id, idx) => {
      if (idx === 0) return; // keep the first image eager (above-the-fold/LCP)
      const node = layout.nodes[id];
      const props = (node.props ?? {}) as Record<string, unknown>;
      if (props.loading === "lazy") return;
      changes.push({
        nodeId: id,
        field: "loading",
        before: props.loading ?? null,
        after: "lazy",
        summary: 'Set loading="lazy" on Image',
      });
      nextNodes[id] = { ...node, props: { ...props, loading: "lazy" } };
    });

    return changes.length ? { changes, layout: { ...layout, nodes: nextNodes } } : { changes, layout };
  },
};
