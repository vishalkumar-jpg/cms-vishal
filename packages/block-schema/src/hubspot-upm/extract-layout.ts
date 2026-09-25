import {
  collectHttpUrlsFromJson,
  stableNodeIdFromPath,
  toJsonValue,
} from "./json-utils";

export { collectHttpUrlsFromJson } from "./json-utils";
import type { HubspotContentKind } from "../hubspot-api";
import type {
  HubspotExtractionDiagnostic,
  HubspotNormalizationStatus,
  HubspotSourceNode,
  HubspotSourceNodeKind,
  JsonValue,
} from "./types";

const HTML_FIELD_NAMES = ["html", "richText", "body", "postBody"] as const;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const extractHtmlFragmentsFromObject = (
  obj: Record<string, unknown>,
): { field: string; value: string }[] => {
  const fragments: { field: string; value: string }[] = [];
  for (const field of HTML_FIELD_NAMES) {
    const v = obj[field];
    if (typeof v === "string" && v.trim()) fragments.push({ field, value: v });
  }
  if (obj.body && isPlainObject(obj.body) && typeof obj.body.html === "string" && obj.body.html.trim()) {
    fragments.push({ field: "body.html", value: obj.body.html });
  }
  return fragments;
};

const readModuleType = (obj: Record<string, unknown>): string | undefined => {
  const candidates = [obj.type, obj.widget_type, obj.widgetType, obj.module_type, obj.moduleType];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return undefined;
};

const readExplicitModuleId = (obj: Record<string, unknown>): string | undefined => {
  for (const c of [obj.module_id, obj.moduleId]) {
    if (typeof c === "string" && c.trim()) return c.trim();
    if (typeof c === "number" && Number.isFinite(c)) return String(c);
  }
  return undefined;
};

/** Generic HubSpot `id` only counts when paired with module-specific type evidence. */
const readModuleId = (obj: Record<string, unknown>): string | undefined => {
  const explicit = readExplicitModuleId(obj);
  if (explicit) return explicit;
  const moduleType = readModuleType(obj);
  if (!moduleType) return undefined;
  const genericId = obj.id;
  if (typeof genericId === "string" && genericId.trim()) return genericId.trim();
  if (typeof genericId === "number" && Number.isFinite(genericId)) return String(genericId);
  return undefined;
};

export const isHubspotModuleLike = (obj: Record<string, unknown>): boolean => {
  if (Array.isArray(obj.rows)) return false;
  if (readExplicitModuleId(obj)) return true;
  const moduleType = readModuleType(obj);
  if (moduleType && isPlainObject(obj.params)) return true;
  if (moduleType && (obj.html || obj.body)) return true;
  if (moduleType && readModuleId(obj)) return true;
  return false;
};

const classifyObjectNode = (obj: Record<string, unknown>): HubspotSourceNodeKind => {
  if (isHubspotModuleLike(obj)) return "module";
  if (Array.isArray(obj.rows)) return "section";
  if (typeof obj.type === "string" && (obj.type === "cell" || obj.type === "column")) return "column";
  if ("width" in obj && ("offset" in obj || "rows" in obj)) return "column";
  return "unknown";
};

export interface LayoutWalkContext {
  hubspotHsId: string;
  hubspotKind: HubspotContentKind;
  diagnostics: HubspotExtractionDiagnostic[];
}

const buildProvenance = (
  ctx: LayoutWalkContext,
  sourcePath: string,
  parentNodeId: string | undefined,
  extractionStatus: HubspotSourceNode["provenance"]["extractionStatus"],
  normalizationStatus: HubspotNormalizationStatus,
): HubspotSourceNode["provenance"] => ({
  hubspotHsId: ctx.hubspotHsId,
  hubspotKind: ctx.hubspotKind,
  sourcePath,
  parentNodeId,
  extractionStatus,
  normalizationStatus,
});

export const walkSourceValue = (
  value: unknown,
  sourcePath: string,
  ctx: LayoutWalkContext,
  parentNodeId: string | undefined,
): HubspotSourceNode | null => {
  if (value === null || value === undefined) return null;

  if (Array.isArray(value)) {
    const arrayNodeId = stableNodeIdFromPath(sourcePath);
    const children = value
      .map((item, index) =>
        walkSourceValue(item, `${sourcePath}/${index}`, ctx, arrayNodeId),
      )
      .filter((n): n is HubspotSourceNode => n !== null);
    const id = arrayNodeId;
    return {
      id,
      sourcePath,
      nodeKind: "row",
      payload: toJsonValue(value),
      htmlFragments: [],
      children,
      provenance: buildProvenance(ctx, sourcePath, parentNodeId, children.length ? "ok" : "partial", "raw_only"),
    };
  }

  if (!isPlainObject(value)) {
    return {
      id: stableNodeIdFromPath(sourcePath),
      sourcePath,
      nodeKind: "field",
      payload: toJsonValue(value),
      htmlFragments: [],
      children: [],
      provenance: buildProvenance(ctx, sourcePath, parentNodeId, "unknown_shape", "raw_only"),
    };
  }

  const obj = value;
  const htmlFragments = extractHtmlFragmentsFromObject(obj);

  const nodeKind = classifyObjectNode(obj);
  const id = stableNodeIdFromPath(sourcePath);
  const moduleType = readModuleType(obj);
  const moduleId = readModuleId(obj);

  if (nodeKind === "module") {
    return {
      id,
      sourcePath,
      nodeKind: "module",
      hubspot: {
        moduleId,
        moduleType,
        definitionId: typeof obj.definition_id === "string" ? obj.definition_id : undefined,
        label: typeof obj.label === "string" ? obj.label : undefined,
      },
      payload: toJsonValue(obj),
      htmlFragments,
      children: [],
      provenance: buildProvenance(ctx, sourcePath, parentNodeId, "ok", "classified"),
    };
  }

  const children: HubspotSourceNode[] = [];

  if (Array.isArray(obj.rows)) {
    obj.rows.forEach((row, index) => {
      const child = walkSourceValue(row, `${sourcePath}/rows/${index}`, ctx, id);
      if (child) children.push(child);
    });
  }

  const childKeys = Object.keys(obj).filter(
    (k) => k !== "rows" && !HTML_FIELD_NAMES.includes(k as (typeof HTML_FIELD_NAMES)[number]),
  );
  for (const key of childKeys.sort()) {
    const childValue = obj[key];
    if (childValue === null || childValue === undefined) continue;
    if (typeof childValue === "object") {
      const child = walkSourceValue(childValue, `${sourcePath}/${key}`, ctx, id);
      if (child) children.push(child);
    }
  }

  let extractionStatus: HubspotSourceNode["provenance"]["extractionStatus"] = "ok";
  if (nodeKind === "unknown" && children.length === 0 && htmlFragments.length === 0) {
    extractionStatus = "unknown_shape";
    ctx.diagnostics.push({
      code: "UNKNOWN_NODE_SHAPE",
      severity: "warning",
      message: "Could not classify HubSpot layout node; raw payload preserved.",
      path: sourcePath,
      hubspotType: moduleType,
    });
  }

  const normalizationStatus: HubspotNormalizationStatus =
    htmlFragments.length > 0 && nodeKind === "unknown" ? "html_only" : nodeKind === "unknown" ? "raw_only" : "classified";

  return {
    id,
    sourcePath,
    nodeKind,
    hubspot: moduleType || moduleId ? { moduleId, moduleType } : undefined,
    payload: toJsonValue(obj),
    htmlFragments,
    children,
    provenance: buildProvenance(ctx, sourcePath, parentNodeId, extractionStatus, normalizationStatus),
    unsupported:
      nodeKind === "unknown"
        ? { paths: [sourcePath], notes: "Unclassified HubSpot node" }
        : undefined,
  };
};

export const buildLayoutSectionRegionNodes = (
  layoutSections: unknown,
  ctx: LayoutWalkContext,
): HubspotSourceNode[] => {
  if (!isPlainObject(layoutSections)) {
    ctx.diagnostics.push({
      code: "INVALID_LAYOUT_SECTIONS",
      severity: "warning",
      message: "layoutSections was present but not an object; stored on sourceRecord only.",
      path: "/layoutSections",
    });
    return [];
  }

  if (Object.keys(layoutSections).length === 0) {
    ctx.diagnostics.push({
      code: "LAYOUT_SECTIONS_EMPTY",
      severity: "info",
      message: "layoutSections object is empty; stored on sourceRecord only.",
      path: "/layoutSections",
    });
    return [];
  }

  const nodes: HubspotSourceNode[] = [];
  for (const key of Object.keys(layoutSections).sort()) {
    const sectionValue = layoutSections[key];
    const path = `/layoutSections/${key}`;
    const child = walkSourceValue(sectionValue, path, ctx, undefined);
    if (child) {
      nodes.push({
        ...child,
        nodeKind: child.nodeKind === "unknown" ? "section" : child.nodeKind,
        sourcePath: path,
        id: stableNodeIdFromPath(path),
        provenance: {
          ...child.provenance,
          sourcePath: path,
          normalizationStatus:
            child.nodeKind === "unknown" ? "raw_only" : child.provenance.normalizationStatus,
        },
      });
    }
  }
  return nodes;
};

export const buildWidgetContainerRegionNodes = (
  widgetContainers: unknown,
  ctx: LayoutWalkContext,
): HubspotSourceNode[] => {
  if (!isPlainObject(widgetContainers)) {
    ctx.diagnostics.push({
      code: "INVALID_WIDGET_CONTAINERS",
      severity: "warning",
      message: "widgetContainers was present but not an object; stored on sourceRecord only.",
      path: "/widgetContainers",
    });
    return [];
  }

  const nodes: HubspotSourceNode[] = [];
  for (const key of Object.keys(widgetContainers).sort()) {
    const path = `/widgetContainers/${key}`;
    const value = widgetContainers[key];
    const child = walkSourceValue(value, path, ctx, undefined);
    if (child) {
      nodes.push({
        ...child,
        nodeKind: "container",
        sourcePath: path,
        id: stableNodeIdFromPath(path),
      });
    }
  }
  return nodes;
};

export const collectAssetsFromPageJson = (
  sourceRecord: JsonValue,
): { url: string; discoveredAtPath: string }[] => {
  const seen = new Set<string>();
  const out: { url: string; discoveredAtPath: string }[] = [];
  collectHttpUrlsFromJson(sourceRecord, "", seen, out);
  return out.sort((a, b) => a.url.localeCompare(b.url) || a.discoveredAtPath.localeCompare(b.discoveredAtPath));
};
