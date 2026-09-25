import { z } from "zod";
import { bindingsSchema, visibleIfSchema } from "./binding";

/**
 * Phase 4 A/B testing: an `Experiment` canvas node attaches to an experiment and
 * maps each of its child subtrees (one per authored variant) to a variant key.
 * `variantKeys[i]` is the key ("A"/"B"/…) for the i-th child subtree. The
 * renderer picks ONE child by the visitor's assigned variant; the editor shows a
 * variant switcher. Absent for non-experiment nodes (byte-identical round-trip).
 */
export const nodeExperimentSchema = z
  .object({
    experimentId: z.string().optional(),
    /** Variant key per child subtree index — `["A","B",…]`. */
    variantKeys: z.array(z.string()).optional().default([]),
  })
  .optional();
export type NodeExperiment = NonNullable<z.infer<typeof nodeExperimentSchema>>;

/**
 * Versioned serialized layout schema — mirrors the Craft.js node-map shape so a
 * page authored in the builder round-trips losslessly to the renderer
 * (TECH-ARCHITECTURE §2.3.1, editor↔renderer parity).
 *
 * Versioning rule (§2.2): every layout records the `schemaVersion` it was
 * authored with. On read (editor AND renderer) `migrate()` upgrades old layouts
 * to `CURRENT_SCHEMA_VERSION`. The POC export carries metadata.version "2.0".
 */

/** Current schema version. Kept as a string to align with the POC's "2.0". */
export const CURRENT_SCHEMA_VERSION = "2.0" as const;

/** A single Craft.js node. `type.resolvedName` keys into the block registry. */
export const blockNodeSchema = z.object({
  type: z.object({ resolvedName: z.string() }),
  isCanvas: z.boolean().optional().default(false),
  props: z.record(z.unknown()).default({}),
  displayName: z.string().optional(),
  custom: z.record(z.unknown()).optional().default({}),
  parent: z.string().nullable().optional().default(null),
  hidden: z.boolean().optional().default(false),
  nodes: z.array(z.string()).optional().default([]),
  linkedNodes: z.record(z.string()).optional().default({}),
  // Data-binding (dynamic): prop→collection-field bindings + node-level
  // conditional visibility. Both optional + absent for static nodes, so existing
  // layouts round-trip byte-identically. See ./binding.ts.
  bindings: bindingsSchema,
  visibleIf: visibleIfSchema,
  // A/B testing (Phase 4): present only on `Experiment` canvas nodes — maps the
  // node's child subtrees to variant keys + the attached experiment. Absent for
  // all other nodes so existing layouts round-trip byte-identically.
  experiment: nodeExperimentSchema,
  // COMPONENTS: inside a component (reusable-block) layout, a node prop may be
  // bound to a component prop key (`componentBinding`) and/or the node may be a
  // named editable Slot (`isSlot` + `slotName`). All optional + absent for plain
  // nodes so existing layouts round-trip byte-identically. See ./component.ts.
  componentBinding: z.record(z.string()).optional(),
  isSlot: z.boolean().optional(),
  slotName: z.string().optional(),
});

export type BlockNode = z.infer<typeof blockNodeSchema>;

/** The flat Craft.js node map: `{ [nodeId]: BlockNode }`. */
export const nodeMapSchema = z.record(blockNodeSchema);
export type NodeMap = z.infer<typeof nodeMapSchema>;

/** The full serialized page layout. */
export const serializedLayoutSchema = z.object({
  schemaVersion: z.string(),
  root: z.string(),
  nodes: nodeMapSchema,
});

export type SerializedLayout = z.infer<typeof serializedLayoutSchema>;

/** SEO metadata parsed from the export `metadata` block. */
export interface PageSeo {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
}

/** An empty, valid layout with a single root Section canvas. */
export const emptyLayout = (): SerializedLayout => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  root: "ROOT",
  nodes: {
    ROOT: {
      type: { resolvedName: "Section" },
      isCanvas: true,
      props: {},
      displayName: "Section",
      custom: {},
      parent: null,
      hidden: false,
      nodes: [],
      linkedNodes: {},
    },
  },
});

const EMPTY_CANVAS_TYPES = new Set(["Section", "Container", "Div", "Row", "Column", "Grid", "Group"]);

/**
 * Whether a serialized fragment has anything meaningful to paint. Used by the
 * builder preview to avoid a zero-height blank when a reusable block's stored
 * layout was wiped (e.g. by an old repair pass) or never authored.
 */
export const layoutHasContent = (layout: SerializedLayout | null | undefined): boolean => {
  if (!layout?.nodes || !layout.root) return false;
  const visit = (id: string): boolean => {
    const node = layout.nodes[id];
    if (!node || node.hidden) return false;
    const type = node.type?.resolvedName;
    const props = (node.props ?? {}) as Record<string, unknown>;
    const childIds = [
      ...(node.nodes ?? []),
      ...Object.values(node.linkedNodes ?? {}),
    ];
    if (childIds.length > 0) {
      return childIds.some(visit);
    }
    if (type === "Navbar") {
      const navItems = props.navItems;
      const links = props.links;
      return (
        (Array.isArray(navItems) && navItems.length > 0) ||
        (Array.isArray(links) && links.length > 0)
      );
    }
    if (type && EMPTY_CANVAS_TYPES.has(type)) return false;
    if (typeof props.text === "string" && props.text.trim().length > 0) return true;
    if (typeof props.label === "string" && props.label.trim().length > 0) return true;
    if (typeof props.src === "string" && props.src.trim().length > 0) return true;
    if (typeof props.url === "string" && props.url.trim().length > 0) return true;
    return type !== "Spacer";
  };
  return visit(layout.root);
};
