import * as React from "react";
import {
  type SerializedLayout,
  type BlockNode,
  type Bindings,
  type VisibleIf,
  type NodeExperiment,
  applyBindings,
  evaluateVisibleIf,
  getCustomCss,
} from "@ob-cms/block-schema";
import type { BlockComponent, BlockRegistryEntry } from "./registry";
import { blockComponents } from "./block-components";
import { OBSiteRoot } from "./site-root";
import type { OBSiteRootBreakpointSource } from "./site-root-breakpoint-sources";
import { StyleBreakpointBlock } from "./style-breakpoint-block";
import { NodeScopeWrapper } from "./scoped-custom-css";
import type { RenderEnv } from "./render-context";
import { hydrateNavbarNodes, ensureObHomepageNavbar } from "./hydrate-navbar";
import { hydratePartnersLogoGrid } from "./hydrate-partners";

/**
 * RenderLayout — walks a serialized Craft.js node map from `root` and renders
 * the React tree from the shared block registry. This is the function the
 * Next.js renderer (Wave 3) calls for SSR. Pure + hook-free + deterministic, so
 * it runs as a React Server Component (no `useContext`/`useState` at this layer)
 * and recurses identically on the client (the Repeater re-enters it per item).
 *
 * Data-binding (dynamic): for every node it (1) resolves bound props against the
 * current repeater `item` (`applyBindings`), and (2) evaluates the node's
 * `visibleIf` against the render `env` + item (locale/authenticated/field),
 * hiding the node when it fails. Both are PURE functions (no React state), so
 * the same code path runs in the renderer (true hide) and the client subtree
 * re-render the Repeater performs. The Repeater itself is a client block that
 * receives the (serializable) node map + its template child ids and repeats them
 * per item via `renderSubtree`.
 *
 * `blocks` may be the full registry (entries with `.component`) or a plain
 * resolvedName→component map (Wave 2 passes editor-wrapped components).
 */

export type BlockMap =
  | Record<string, BlockRegistryEntry>
  | Record<string, BlockComponent>;

const resolveComponent = (blocks: BlockMap, type: string): BlockComponent | undefined => {
  const entry = (blocks as Record<string, unknown>)[type];
  if (!entry) return undefined;
  if (typeof entry === "function") return entry as BlockComponent;
  if (typeof entry === "object" && entry !== null) {
    if ("component" in entry) {
      return (entry as BlockRegistryEntry).component;
    }
    // forwardRef / memo exotic components are plain objects (not functions).
    if ("$$typeof" in entry || "render" in entry) {
      return entry as BlockComponent;
    }
  }
  return undefined;
};

/** A node carries optional `bindings`/`visibleIf`/`experiment` (@ob-cms/block-schema). */
type DynNode = BlockNode & {
  bindings?: Bindings;
  visibleIf?: VisibleIf;
  experiment?: NodeExperiment;
};

/** Options threaded (as plain data — NOT React context) through the recursion. */
export interface RenderNodeOpts {
  env: RenderEnv;
  /** Field data for bindings and `visibleIf: field` (layout root or Repeater item). */
  item?: Record<string, unknown> | null;
}

/**
 * Render a single node (and its subtree) to React elements. Exported so the
 * Repeater block can re-enter the SAME walker per item (parity, one
 * implementation). Pure — safe in RSC and on the client.
 */
export const renderNode = (
  nodeId: string,
  data: SerializedLayout,
  blocks: BlockMap,
  opts: RenderNodeOpts,
): React.ReactNode => {
  const node = data.nodes[nodeId] as DynNode | undefined;
  if (!node || node.hidden) return null;

  // Conditional visibility — evaluated against the active env + current item.
  // In the editor (`env.editor`) we keep the node (the canvas paints a "hidden"
  // affordance); on the public renderer a failing condition removes it.
  if (
    !opts.env.editor &&
    !evaluateVisibleIf(node.visibleIf, {
      locale: opts.env.locale,
      authenticated: opts.env.authenticated,
      audiences: opts.env.audiences,
      item: opts.item,
    })
  ) {
    return null;
  }

  const type = node.type.resolvedName;
  const Comp = resolveComponent(blocks, type);
  if (!Comp) return null; // Unknown block type — fail soft.

  // Resolve bound props against the current item (identity when no bindings /
  // outside a repeater → backward-compatible).
  const resolvedProps = applyBindings(node.props, node.bindings, opts.item);

  const childIds = [
    ...(node.nodes ?? []),
    ...Object.values(node.linkedNodes ?? {}),
  ];

  const customCss = getCustomCss(resolvedProps.styles);

  const wrapScoped = (el: React.ReactElement): React.ReactNode =>
    customCss ? (
      <NodeScopeWrapper nodeId={nodeId} customCss={customCss}>
        {el}
      </NodeScopeWrapper>
    ) : (
      el
    );

  // The Repeater repeats its template subtree itself: hand it the SERIALIZABLE
  // node map + template child ids + env so it can re-enter `renderSubtree` per
  // published item. We pass ONLY plain JSON (no component map — the client
  // Repeater imports the default `blockRegistry` itself) so these props cross
  // the RSC→client boundary cleanly. Don't pre-render its children here.
  if (type === "Repeater") {
    return wrapScoped(
      <Comp
        key={nodeId}
        {...resolvedProps}
        __data={data}
        __templateIds={childIds}
        __env={opts.env}
      />,
    );
  }

  // Experiment (A/B): like the Repeater, the block re-enters the shared walker
  // itself — but for only ONE of its child subtrees (the visitor's assigned
  // variant). Inject the serializable node map + variant child ids + the node's
  // experiment mapping + env so it can bucket the visitor and fire an exposure
  // beacon. Plain JSON only (RSC→client boundary safe).
  if (type === "Experiment") {
    return wrapScoped(
      <Comp
        key={nodeId}
        {...resolvedProps}
        __data={data}
        __variantIds={childIds}
        __experiment={node.experiment ?? {}}
        __env={opts.env}
      />,
    );
  }

  const children = childIds.map((childId) => renderNode(childId, data, blocks, opts));

  return wrapScoped(
    <StyleBreakpointBlock key={nodeId}>
      <Comp {...resolvedProps}>{children.length ? children : undefined}</Comp>
    </StyleBreakpointBlock>,
  );
};

/**
 * Render a list of subtree roots under a given item/env — the Repeater's hook
 * into the shared walker. Pure; the Repeater calls it once per item.
 */
export const renderSubtree = (
  childIds: string[],
  data: SerializedLayout,
  blocks: BlockMap,
  opts: RenderNodeOpts,
): React.ReactNode =>
  childIds.map((cid) => renderNode(cid, data, blocks, opts));

export interface RenderLayoutProps {
  /** Serialized layout (already migrated/repaired — see @ob-cms/block-schema). */
  data: SerializedLayout;
  /** Optional override registry (admin passes editor-wrapped components). */
  blocks?: BlockMap;
  /**
   * Wrap output in `<OBSiteRoot>` (`.ob-site cms-site`) so the scoped block CSS
   * (`@ob-cms/blocks/blocks.css`) + container-query responsive system apply.
   * Default true. Set false when the host already provides `.ob-site` (e.g. the
   * builder canvas).
   */
  wrap?: boolean;
  /** Extra class on the site-root wrapper (only when `wrap`). */
  className?: string;
  /**
   * Render environment for data-binding visibility (locale / visitor session).
   * Absent → defaults (visible). The renderer passes the per-request locale so
   * `visibleIf: locale == es` resolves correctly.
   */
  env?: RenderEnv;
  /**
   * Run legacy navbar/partners repair passes before paint. Off by default on the
   * public renderer (layouts should be normalized at publish); enable in admin
   * preview/compare where stored layouts may predate repair scripts.
   */
  repairLegacyLayout?: boolean;
  /**
   * Collection item field data for root-level bindings and `visibleIf: field`.
   * Omitted or null → static props only (backward-compatible).
   */
  item?: Record<string, unknown> | null;
  /**
   * Passed to the `OBSiteRoot` wrapper when `wrap` is true. Set to `"container"`
   * on the published renderer so breakpoint/viewport follow measured container width.
   */
  breakpointSource?: OBSiteRootBreakpointSource;
}

const applyLegacyLayoutRepairs = (data: SerializedLayout): SerializedLayout => {
  const ensured = ensureObHomepageNavbar(data);
  const hydratedNav = hydrateNavbarNodes(ensured.layout.nodes as Record<string, unknown>);
  const baseNodes = hydratedNav.changed
    ? hydratedNav.nodes
    : (ensured.layout.nodes as Record<string, unknown>);
  const hydratedPartners = hydratePartnersLogoGrid(baseNodes);
  const nodes = hydratedPartners.changed ? hydratedPartners.nodes : baseNodes;
  if (!ensured.changed && !hydratedNav.changed && !hydratedPartners.changed) return data;
  return { ...ensured.layout, nodes: nodes as typeof data.nodes };
};

export const RenderLayout: React.FC<RenderLayoutProps> = ({
  data,
  blocks = blockComponents,
  wrap = true,
  className,
  env,
  repairLegacyLayout = false,
  item = null,
  breakpointSource,
}) => {
  if (!data || !data.nodes || !data.nodes[data.root]) return null;
  const layout = repairLegacyLayout ? applyLegacyLayoutRepairs(data) : data;
  const tree = renderNode(layout.root, layout, blocks, { env: env ?? {}, item: item ?? null });
  return wrap ? (
    <OBSiteRoot className={className} breakpointSource={breakpointSource}>
      {tree}
    </OBSiteRoot>
  ) : (
    <>{tree}</>
  );
};
