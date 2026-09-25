import { resolveTopLevelBodyHtml, type HubspotContentKind } from "../hubspot-api";
import { withHubspotUniversalPageDigest } from "./canonicalize";
import { discoverHubspotMediaAssetsFromPage } from "./asset-discovery";
import { discoverResponsiveAssetDiagnostics } from "./asset-responsive-diagnostics";
import {
  buildLayoutSectionRegionNodes,
  buildWidgetContainerRegionNodes,
  type LayoutWalkContext,
} from "./extract-layout";
import { computeLegacyHtmlPartsFromRaw } from "./legacy-html";
import { toJsonValue } from "./json-utils";
import type {
  ExtractHubspotUniversalPageInput,
  HubspotContentRegion,
  HubspotExtractionDiagnostic,
  HubspotFieldValue,
  HubspotUniversalPage,
  HubspotSourceNode,
  HubspotUniversalPageMetadata,
  JsonValue,
} from "./types";
import { HUBSPOT_UNIVERSAL_PAGE_MODEL_VERSION } from "./types";

const KNOWN_TOP_LEVEL_KEYS = new Set([
  "id",
  "name",
  "slug",
  "htmlTitle",
  "metaDescription",
  "updatedAt",
  "updated",
  "publishDate",
  "state",
  "currentlyPublished",
  "html",
  "body",
  "postBody",
  "widgetContainers",
  "featuredImage",
  "authorName",
  "tagIds",
  "categoryId",
  "url",
  "language",
  "layoutSections",
]);

const stringField = (raw: unknown): HubspotFieldValue<string> => {
  if (raw === undefined || raw === null) return { status: "absent" };
  if (typeof raw === "string") {
    return raw.trim()
      ? { status: "present", source: raw, normalized: raw }
      : { status: "absent" };
  }
  return { status: "unparseable", source: toJsonValue(raw), reason: "expected string" };
};

const tagIdsField = (raw: unknown): HubspotFieldValue<number[]> => {
  if (raw === undefined || raw === null) return { status: "absent" };
  if (!Array.isArray(raw)) {
    return { status: "unparseable", source: toJsonValue(raw), reason: "expected number[]" };
  }
  const source = toJsonValue(raw);
  if (raw.length === 0) {
    return { status: "present", source, normalized: [] };
  }
  for (const entry of raw) {
    if (typeof entry !== "number" || !Number.isFinite(entry)) {
      return { status: "unparseable", source, reason: "expected number[]" };
    }
  }
  return { status: "present", source, normalized: raw as number[] };
};

const publishStateFromRaw = (raw: Record<string, unknown>): HubspotFieldValue<string> => {
  const state = raw.state;
  if (typeof state === "string" && state.trim()) {
    return { status: "present", source: state, normalized: state };
  }
  if (raw.currentlyPublished === true) {
    return { status: "present", source: true, normalized: "PUBLISHED" };
  }
  return { status: "absent" };
};

const buildMetadata = (raw: Record<string, unknown>): HubspotUniversalPageMetadata => {
  const titleSource = raw.name ?? raw.htmlTitle;
  const updatedSource = raw.updatedAt ?? raw.updated;
  return {
    title: stringField(titleSource),
    slug: stringField(raw.slug),
    htmlTitle: stringField(raw.htmlTitle),
    metaDescription: stringField(raw.metaDescription),
    url: stringField(raw.url),
    language: stringField(raw.language),
    publishState: publishStateFromRaw(raw),
    updatedAt: stringField(updatedSource),
    publishDate: stringField(raw.publishDate),
    featuredImage: stringField(raw.featuredImage),
    authorName: stringField(raw.authorName),
    tagIds: tagIdsField(raw.tagIds),
  };
};

const unmappedTopLevelDiagnostics = (
  raw: Record<string, unknown>,
  diagnostics: HubspotExtractionDiagnostic[],
): void => {
  for (const key of Object.keys(raw).sort()) {
    if (!KNOWN_TOP_LEVEL_KEYS.has(key)) {
      diagnostics.push({
        code: "UNMAPPED_TOP_LEVEL_FIELD",
        severity: "info",
        message: `Top-level HubSpot field preserved on sourceRecord: ${key}`,
        path: `/${key}`,
      });
    }
  }
};

const htmlBodyRegionNodes = (raw: Record<string, unknown>): HubspotSourceNode[] => {
  const fields: { key: string; value: string }[] = [];
  for (const key of ["postBody", "html"] as const) {
    const v = raw[key];
    if (typeof v === "string" && v.trim()) fields.push({ key, value: v });
  }
  const bodyHtml = resolveTopLevelBodyHtml(raw);
  if (bodyHtml) fields.push({ key: "body", value: bodyHtml });
  if (fields.length === 0) return [];
  return fields.map(({ key, value }) => ({
    id: `html_body_${key}`,
    sourcePath: `/${key}`,
    nodeKind: "field" as const,
    payload: value,
    htmlFragments: [{ field: key, value }],
    children: [],
    provenance: {
      hubspotHsId: "",
      hubspotKind: "page" as HubspotContentKind,
      sourcePath: `/${key}`,
      extractionStatus: "ok" as const,
      normalizationStatus: "html_only" as const,
    },
  }));
};

const patchHtmlBodyProvenance = (
  nodes: HubspotSourceNode[],
  hsId: string,
  kind: HubspotContentKind,
): HubspotSourceNode[] =>
  nodes.map((n) => ({
    ...n,
    provenance: { ...n.provenance, hubspotHsId: hsId, hubspotKind: kind },
  }));

export const extractHubspotUniversalPage = (
  input: ExtractHubspotUniversalPageInput,
): HubspotUniversalPage => {
  const { raw, kind, hsId, extractedAtIso } = input;
  const diagnostics: HubspotExtractionDiagnostic[] = [];
  unmappedTopLevelDiagnostics(raw, diagnostics);

  const walkCtx: LayoutWalkContext = {
    hubspotHsId: hsId,
    hubspotKind: kind,
    diagnostics,
  };

  const regions: HubspotContentRegion[] = [];

  const htmlNodes = patchHtmlBodyProvenance(htmlBodyRegionNodes(raw), hsId, kind);
  if (htmlNodes.length > 0) {
    regions.push({ kind: "html_body", nodes: htmlNodes });
  }

  if (raw.layoutSections !== undefined) {
    const nodes = buildLayoutSectionRegionNodes(raw.layoutSections, walkCtx);
    if (nodes.length > 0) regions.push({ kind: "layout_sections", nodes });
  }

  if (raw.widgetContainers !== undefined) {
    const nodes = buildWidgetContainerRegionNodes(raw.widgetContainers, walkCtx);
    if (nodes.length > 0) regions.push({ kind: "widget_containers", nodes });
  }

  const sourceRecord = toJsonValue(raw) as JsonValue;
  const metadata = buildMetadata(raw);
  const legacyHtmlParts = computeLegacyHtmlPartsFromRaw(raw);

  const pageWithoutDigest: Omit<HubspotUniversalPage, "digest"> = {
    modelVersion: HUBSPOT_UNIVERSAL_PAGE_MODEL_VERSION,
    source: { kind, hsId, extractedAtIso },
    metadata,
    regions,
    sourceRecord,
    assets: [],
    diagnostics,
    legacyHtmlParts,
  };

  const responsiveAssetDiagnostics = discoverResponsiveAssetDiagnostics(sourceRecord);
  const withAssets: Omit<HubspotUniversalPage, "digest"> = {
    ...pageWithoutDigest,
    diagnostics: [...pageWithoutDigest.diagnostics, ...responsiveAssetDiagnostics],
    assets: discoverHubspotMediaAssetsFromPage(pageWithoutDigest as HubspotUniversalPage),
  };

  return withHubspotUniversalPageDigest(withAssets);
};
