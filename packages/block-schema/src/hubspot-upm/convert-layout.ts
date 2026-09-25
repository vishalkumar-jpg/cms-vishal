import {
  CURRENT_SCHEMA_VERSION,
  emptyLayout,
  layoutHasContent,
  type BlockNode,
  type NodeMap,
  type SerializedLayout,
} from "../layout";
import { FLEX_CHILD_DEFAULT_FLEX } from "../block-props";
import { migrate } from "../migrate";
import { repairLayout } from "../repair";
import {
  COLUMN_BLOCK,
  CONTAINER_BLOCK,
  EMBED_BLOCK,
  GROUP_BLOCK,
  ROW_BLOCK,
  RICH_TEXT_BLOCK,
  SECTION_BLOCK,
} from "../resolved-block-names";
import { createNativeLeafBlock } from "../native-components";
import { sanitizeEmbedHtml, sanitizeHtml } from "../sanitize";
import {
  applyHubspotDesignToBlock,
  designContractDiagnosticsToLayout,
  indexHubspotDesignBundlesBySourcePath,
} from "./apply-hubspot-design";
import {
  buildHubspotPageDesignContract,
  type HubspotNodeDesignBundle,
  type HubspotPageDesignContract,
} from "./hubspot-design-contract";
import { tryConvertHubspotModuleNode } from "./convert-modules";
import { buildHubspotNodeCustom, HUBSPOT_LAYOUT_CUSTOM_KEY } from "./hubspot-node-custom";
import { stableNodeIdFromPath } from "./json-utils";
import type {
  HubspotContentRegion,
  HubspotExtractionDiagnostic,
  HubspotSourceNode,
  HubspotSourceNodeKind,
  HubspotUniversalPage,
  JsonValue,
} from "./types";

/** HubSpot drag-and-drop layout grid base (12-column convention). */
export const HUBSPOT_LAYOUT_GRID_COLUMNS = 12;

export interface ConvertHubspotUpmToLayoutOptions {
  /** Include `html_body` region nodes (default false for import — avoids duplicating legacy HTML). */
  includeHtmlBody?: boolean;
  /** Include `widget_containers` region (default true). */
  includeWidgetContainers?: boolean;
  /** Apply H1 design contract to native blocks (default true). */
  applyHubspotDesign?: boolean;
  /** Pre-built H1 contract; when omitted and applyHubspotDesign, built once per conversion. */
  designContract?: HubspotPageDesignContract;
}

export interface HubspotDeferredModuleRef {
  sourcePath: string;
  moduleId?: string;
  moduleType?: string;
}

export interface HubspotLayoutConversionResult {
  layout: SerializedLayout;
  diagnostics: HubspotExtractionDiagnostic[];
  deferredModules: HubspotDeferredModuleRef[];
  hasStructuralLayout: boolean;
}

const DEFAULT_CONVERT_OPTIONS: Required<Omit<ConvertHubspotUpmToLayoutOptions, "designContract">> = {
  includeHtmlBody: false,
  includeWidgetContainers: true,
  applyHubspotDesign: true,
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const readColumnFlex = (
  payload: JsonValue,
  diagnostics: HubspotExtractionDiagnostic[],
  path: string,
): number => {
  if (isPlainObject(payload)) {
    const offset = payload.offset;
    if (offset != null && Number(offset) !== 0) {
      diagnostics.push({
        code: "LAYOUT_AMBIGUOUS_OFFSET",
        severity: "warning",
        message:
          "HubSpot column offset cannot be represented in OB layout; source preserved in provenance only.",
        path,
      });
    }
    const width = payload.width;
    if (typeof width === "number" && width > 0 && width <= HUBSPOT_LAYOUT_GRID_COLUMNS) {
      return width / HUBSPOT_LAYOUT_GRID_COLUMNS;
    }
  }
  return FLEX_CHILD_DEFAULT_FLEX;
};

const htmlFromFragments = (node: HubspotSourceNode): string =>
  node.htmlFragments
    .map((f) => f.value)
    .filter(Boolean)
    .join("\n");

interface MutableLayoutBuilder {
  root: string;
  nodes: NodeMap;
  appendChild(parentId: string, nodeId: string, node: BlockNode): void;
}

const createBuilder = (): MutableLayoutBuilder => {
  const seed = emptyLayout();
  const nodes: NodeMap = { ...seed.nodes };
  const root = seed.root;
  return {
    root,
    nodes,
    appendChild(parentId, nodeId, node) {
      nodes[nodeId] = node;
      const parent = nodes[parentId];
      if (parent) {
        parent.nodes = [...(parent.nodes ?? []), nodeId];
      }
    },
  };
};

const canvasNode = (
  id: string,
  resolvedName: string,
  parent: string,
  props: Record<string, unknown>,
  custom: Record<string, unknown>,
): BlockNode => ({
  type: { resolvedName },
  isCanvas: true,
  props,
  displayName: resolvedName,
  custom,
  parent,
  hidden: false,
  nodes: [],
  linkedNodes: {},
});

const appendRichTextIfNeeded = (
  builder: MutableLayoutBuilder,
  parentId: string,
  node: HubspotSourceNode,
  suffix: string,
): void => {
  const html = sanitizeHtml(htmlFromFragments(node));
  if (!html.trim()) return;
  const id = stableNodeIdFromPath(`${node.sourcePath}/${suffix}`);
  builder.appendChild(
    parentId,
    id,
    createNativeLeafBlock({
      nodeId: id,
      parentId,
      payload: { resolvedName: RICH_TEXT_BLOCK, props: { html } },
      custom: buildHubspotNodeCustom(node, "html_fragment"),
    }),
  );
};

interface ConversionCtx {
  diagnostics: HubspotExtractionDiagnostic[];
  deferredModules: HubspotDeferredModuleRef[];
  designBundlesBySourcePath: Map<string, HubspotNodeDesignBundle>;
}

const convertModulePlaceholder = (
  builder: MutableLayoutBuilder,
  parentId: string,
  node: HubspotSourceNode,
  ctx: ConversionCtx,
): void => {
  const nativeConversion = tryConvertHubspotModuleNode(node, parentId);
  if (nativeConversion) {
    for (const { nodeId, node: blockNode } of nativeConversion.blocks) {
      const resolvedName = blockNode.type.resolvedName ?? "";
      const applied = applyHubspotDesignToBlock({
        block: blockNode,
        resolvedName,
        sourcePath: node.sourcePath,
        bundle: ctx.designBundlesBySourcePath.get(node.sourcePath),
      });
      builder.appendChild(parentId, nodeId, applied.block);
      ctx.diagnostics.push(...applied.diagnostics);
    }
    ctx.diagnostics.push(...nativeConversion.diagnostics);
    return;
  }

  ctx.deferredModules.push({
    sourcePath: node.sourcePath,
    moduleId: node.hubspot?.moduleId,
    moduleType: node.hubspot?.moduleType,
  });
  ctx.diagnostics.push({
    code: "LAYOUT_MODULE_DEFERRED",
    severity: "info",
    message:
      "HubSpot module deferred to a later native conversion phase; structural placeholder emitted.",
    path: node.sourcePath,
    hubspotType: node.hubspot?.moduleType,
  });
  const id = stableNodeIdFromPath(`${node.sourcePath}/module_placeholder`);
  builder.appendChild(
    parentId,
    id,
    canvasNode(id, GROUP_BLOCK, parentId, {}, buildHubspotNodeCustom(node, "deferred_module")),
  );
};

const convertChildren = (
  builder: MutableLayoutBuilder,
  parentId: string,
  nodes: HubspotSourceNode[],
  ctx: ConversionCtx,
): void => {
  for (const child of nodes) {
    convertUpmNode(builder, parentId, child, ctx);
  }
};

const wrapWithContainer = (
  builder: MutableLayoutBuilder,
  sectionId: string,
  run: (containerId: string) => void,
): void => {
  const containerId = stableNodeIdFromPath(`${sectionId}/container`);
  builder.appendChild(
    sectionId,
    containerId,
    canvasNode(containerId, CONTAINER_BLOCK, sectionId, {}, {}),
  );
  run(containerId);
};

const convertUpmNode = (
  builder: MutableLayoutBuilder,
  parentId: string,
  node: HubspotSourceNode,
  ctx: ConversionCtx,
): void => {
  switch (node.nodeKind) {
    case "module":
      convertModulePlaceholder(builder, parentId, node, ctx);
      return;
    case "field": {
      appendRichTextIfNeeded(builder, parentId, node, "field");
      return;
    }
    case "row": {
      const rowId = node.id;
      builder.appendChild(
        parentId,
        rowId,
        canvasNode(rowId, ROW_BLOCK, parentId, {}, buildHubspotNodeCustom(node, "structural")),
      );
      appendRichTextIfNeeded(builder, rowId, node, "row_intro");
      convertChildren(builder, rowId, node.children, ctx);
      return;
    }
    case "column": {
      const colId = node.id;
      builder.appendChild(
        parentId,
        colId,
        canvasNode(
          colId,
          COLUMN_BLOCK,
          parentId,
          { flex: readColumnFlex(node.payload, ctx.diagnostics, node.sourcePath) },
          buildHubspotNodeCustom(node, "structural"),
        ),
      );
      appendRichTextIfNeeded(builder, colId, node, "column_intro");
      convertChildren(builder, colId, node.children, ctx);
      return;
    }
    case "container": {
      const containerId = node.id;
      builder.appendChild(
        parentId,
        containerId,
        canvasNode(containerId, CONTAINER_BLOCK, parentId, {}, buildHubspotNodeCustom(node, "structural")),
      );
      appendRichTextIfNeeded(builder, containerId, node, "container_intro");
      convertChildren(builder, containerId, node.children, ctx);
      return;
    }
    case "section":
    case "unknown": {
      if (
        node.nodeKind === "unknown" &&
        node.children.length === 0 &&
        !htmlFromFragments(node).trim()
      ) {
        ctx.diagnostics.push({
          code: "LAYOUT_UNSUPPORTED_NODE",
          severity: "warning",
          message: "Unsupported HubSpot layout node skipped during conversion.",
          path: node.sourcePath,
        });
        return;
      }
      const sectionId = node.id;
      builder.appendChild(
        parentId,
        sectionId,
        canvasNode(sectionId, SECTION_BLOCK, parentId, {}, buildHubspotNodeCustom(node, "structural")),
      );
      wrapWithContainer(builder, sectionId, (containerId) => {
        appendRichTextIfNeeded(builder, containerId, node, "section_intro");
        if (node.children.length === 0 && htmlFromFragments(node).trim()) {
          ctx.diagnostics.push({
            code: "LAYOUT_EMPTY_SECTION",
            severity: "info",
            message:
              "Section had no structural children; HTML fragment placed as content placeholder.",
            path: node.sourcePath,
          });
        }
        convertChildren(builder, containerId, node.children, ctx);
      });
      return;
    }
    default:
      return;
  }
};

const regionByKind = (upm: HubspotUniversalPage, kind: HubspotContentRegion["kind"]) =>
  upm.regions.find((r) => r.kind === kind);

const appendRegionRoots = (
  builder: MutableLayoutBuilder,
  region: HubspotContentRegion | undefined,
  ctx: ConversionCtx,
): void => {
  if (!region) return;
  for (const root of region.nodes) {
    convertUpmNode(builder, builder.root, root, ctx);
  }
};

/** Pure UPM → OB SerializedLayout (Phase D structural conversion). Does not mutate `upm`. */
export const convertHubspotUpmToLayout = (
  upm: HubspotUniversalPage,
  options?: ConvertHubspotUpmToLayoutOptions,
): HubspotLayoutConversionResult => {
  const opts = {
    ...DEFAULT_CONVERT_OPTIONS,
    ...options,
    applyHubspotDesign:
      options?.applyHubspotDesign ?? DEFAULT_CONVERT_OPTIONS.applyHubspotDesign,
  };
  const diagnostics: HubspotExtractionDiagnostic[] = [...upm.diagnostics];
  const deferredModules: HubspotDeferredModuleRef[] = [];
  let designBundlesBySourcePath = new Map<string, HubspotNodeDesignBundle>();
  if (opts.applyHubspotDesign) {
    const contract = options?.designContract ?? buildHubspotPageDesignContract(upm);
    designBundlesBySourcePath = indexHubspotDesignBundlesBySourcePath(contract);
    diagnostics.push(...designContractDiagnosticsToLayout(contract.diagnostics));
  }
  const ctx: ConversionCtx = { diagnostics, deferredModules, designBundlesBySourcePath };

  const hasLayoutSections = upm.regions.some(
    (r) => r.kind === "layout_sections" && r.nodes.length > 0,
  );
  const hasWidgets =
    opts.includeWidgetContainers &&
    upm.regions.some((r) => r.kind === "widget_containers" && r.nodes.length > 0);
  const hasStructuralLayout = hasLayoutSections || hasWidgets;

  if (!hasStructuralLayout) {
    return {
      layout: migrate(repairLayout(emptyLayout())),
      diagnostics,
      deferredModules,
      hasStructuralLayout: false,
    };
  }

  const builder = createBuilder();

  if (opts.includeHtmlBody) {
    appendRegionRoots(builder, regionByKind(upm, "html_body"), ctx);
  }
  appendRegionRoots(builder, regionByKind(upm, "layout_sections"), ctx);
  if (opts.includeWidgetContainers) {
    appendRegionRoots(builder, regionByKind(upm, "widget_containers"), ctx);
  }

  const layout = migrate(
    repairLayout({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      root: builder.root,
      nodes: builder.nodes,
    }),
  );

  const hasMeaningfulStructuralContent =
    layoutHasContent(layout) || deferredModules.length > 0;

  return {
    layout: hasMeaningfulStructuralContent
      ? layout
      : migrate(repairLayout(emptyLayout())),
    diagnostics,
    deferredModules,
    hasStructuralLayout: hasMeaningfulStructuralContent,
  };
};

/** Embed fallback when UPM has no structural layout (import path only). */
export const hubspotLegacyHtmlEmbedLayout = (html: string, hsId: string): SerializedLayout => {
  const base = emptyLayout();
  const embedId = stableNodeIdFromPath("/legacy/embed");
  const nodes: NodeMap = {
    ...base.nodes,
    [embedId]: createNativeLeafBlock({
      nodeId: embedId,
      parentId: base.root,
      payload: { resolvedName: EMBED_BLOCK, props: { html: sanitizeEmbedHtml(html) } },
      custom: {
        [HUBSPOT_LAYOUT_CUSTOM_KEY]: {
          sourcePath: "/legacyHtml",
          hsId,
          nodeKind: "field" satisfies HubspotSourceNodeKind,
          conversionRole: "legacy_embed_fallback",
        },
      },
    }),
  };
  nodes[base.root] = { ...nodes[base.root]!, nodes: [embedId] };
  return migrate(repairLayout({ schemaVersion: CURRENT_SCHEMA_VERSION, root: base.root, nodes }));
};
