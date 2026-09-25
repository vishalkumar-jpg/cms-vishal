import type { SerializedLayout, BlockNode } from "@ob-cms/block-schema";

/**
 * Structural diff between two `SerializedLayout` node maps for the version
 * compare UI. We compare by node id (Craft ids are stable across saves) and
 * classify each block as:
 *
 *  - `added`    — present in `next`, absent in `prev`
 *  - `removed`  — present in `prev`, absent in `next`
 *  - `moved`    — same id, but a different `parent` (or a different index under
 *                 the same parent) — i.e. the block was re-ordered / re-parented
 *  - `changed`  — same id + same position, but a shallow prop compare differs;
 *                 we surface the changed prop names, plus before→after values for
 *                 text-ish props (string/number/boolean) so the UI can show them.
 *  - `unchanged`— identical (excluded from the summary lists)
 *
 * Text-prop change detection: for each differing prop whose value is a scalar
 * (string | number | boolean) on either side, we record `{ prop, before, after }`
 * so the drawer can render "title: 'Old' → 'New'".
 */

export type DiffKind = "added" | "removed" | "moved" | "changed" | "unchanged";

export interface PropChange {
  prop: string;
  before: unknown;
  after: unknown;
  /** true when both sides are scalar (renderable as before→after text). */
  scalar: boolean;
}

export interface BlockDiff {
  id: string;
  kind: DiffKind;
  /** Human label — the block's resolvedName / displayName (from whichever side). */
  label: string;
  /** Changed prop names (for `changed`). */
  changedProps: string[];
  /** Scalar before→after changes (subset of changedProps), for text display. */
  textChanges: PropChange[];
  /** For `moved`: the parent ids before/after. */
  movedFrom?: string | null;
  movedTo?: string | null;
}

export interface LayoutDiff {
  blocks: BlockDiff[];
  summary: { added: number; removed: number; moved: number; changed: number };
}

const isScalar = (v: unknown): v is string | number | boolean =>
  typeof v === "string" || typeof v === "number" || typeof v === "boolean";

const nodeLabel = (node: BlockNode | undefined): string =>
  node?.displayName ?? node?.type?.resolvedName ?? "Block";

/** Shallow prop compare. Returns changed prop keys + scalar before/after list. */
const diffProps = (
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): { changedProps: string[]; textChanges: PropChange[] } => {
  const changedProps: string[] = [];
  const textChanges: PropChange[] = [];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const before = a[key];
    const after = b[key];
    // Deep-equality via JSON for stable ordering of nested structures; scalars
    // compare fast on the strict-equality short-circuit.
    if (before === after) continue;
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    changedProps.push(key);
    const scalar = isScalar(before) || isScalar(after);
    textChanges.push({ prop: key, before, after, scalar });
  }
  changedProps.sort();
  return { changedProps, textChanges };
};

/** Index of a node id within its parent's child list (-1 if none / not found). */
const indexInParent = (layout: SerializedLayout, id: string): number => {
  const node = layout.nodes[id];
  const parentId = node?.parent;
  if (!parentId) return -1;
  const parent = layout.nodes[parentId];
  return parent?.nodes?.indexOf(id) ?? -1;
};

/** Compute the structural diff of two layouts (prev = older, next = newer). */
export const diffLayouts = (
  prev: SerializedLayout,
  next: SerializedLayout,
): LayoutDiff => {
  const blocks: BlockDiff[] = [];
  const summary = { added: 0, removed: 0, moved: 0, changed: 0 };
  const ids = new Set([...Object.keys(prev.nodes), ...Object.keys(next.nodes)]);

  for (const id of ids) {
    const a = prev.nodes[id];
    const b = next.nodes[id];

    if (a && !b) {
      summary.removed += 1;
      blocks.push({ id, kind: "removed", label: nodeLabel(a), changedProps: [], textChanges: [] });
      continue;
    }
    if (!a && b) {
      summary.added += 1;
      blocks.push({ id, kind: "added", label: nodeLabel(b), changedProps: [], textChanges: [] });
      continue;
    }
    if (!a || !b) continue; // unreachable, keeps TS happy

    const movedParent = (a.parent ?? null) !== (b.parent ?? null);
    const movedIndex =
      !movedParent && indexInParent(prev, id) !== indexInParent(next, id);
    const { changedProps, textChanges } = diffProps(a.props ?? {}, b.props ?? {});
    const propsChanged = changedProps.length > 0;
    // A hidden/isCanvas flip also counts as a change.
    const flagsChanged =
      (a.hidden ?? false) !== (b.hidden ?? false) ||
      (a.isCanvas ?? false) !== (b.isCanvas ?? false);

    if (movedParent || movedIndex) {
      summary.moved += 1;
      // If it also changed props, still count it once as moved but keep the
      // changed prop info attached for display.
      blocks.push({
        id,
        kind: "moved",
        label: nodeLabel(b),
        changedProps,
        textChanges,
        movedFrom: a.parent ?? null,
        movedTo: b.parent ?? null,
      });
      continue;
    }
    if (propsChanged || flagsChanged) {
      summary.changed += 1;
      const props = propsChanged ? changedProps : [];
      if (flagsChanged && !propsChanged) props.push("visibility");
      blocks.push({ id, kind: "changed", label: nodeLabel(b), changedProps: props, textChanges });
      continue;
    }
    blocks.push({ id, kind: "unchanged", label: nodeLabel(b), changedProps: [], textChanges: [] });
  }

  // Order: added, removed, moved, changed, then unchanged — stable within group.
  const rank: Record<DiffKind, number> = {
    added: 0,
    removed: 1,
    moved: 2,
    changed: 3,
    unchanged: 4,
  };
  blocks.sort((x, y) => rank[x.kind] - rank[y.kind]);
  return { blocks, summary };
};

/** One-line summary text, e.g. "+2 blocks, −1 block, 3 changed". */
export const summaryText = (summary: LayoutDiff["summary"]): string => {
  const parts: string[] = [];
  if (summary.added) parts.push(`+${summary.added} block${summary.added > 1 ? "s" : ""}`);
  if (summary.removed) parts.push(`−${summary.removed} block${summary.removed > 1 ? "s" : ""}`);
  if (summary.moved) parts.push(`${summary.moved} moved`);
  if (summary.changed) parts.push(`${summary.changed} changed`);
  return parts.length ? parts.join(", ") : "No structural changes";
};
