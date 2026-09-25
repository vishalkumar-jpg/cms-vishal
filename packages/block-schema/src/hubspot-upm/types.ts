import type { HubspotContentKind } from "../hubspot-api";

/** Universal Page Model schema version (additive changes bump minor only). */
export const HUBSPOT_UNIVERSAL_PAGE_MODEL_VERSION = "1";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type HubspotFieldValue<T> =
  | { status: "present"; source: JsonValue; normalized: T }
  | { status: "absent" }
  | { status: "unparseable"; source: JsonValue; reason: string };

export type HubspotSourceNodeKind =
  | "section"
  | "row"
  | "column"
  | "module"
  | "container"
  | "field"
  | "unknown";

export type HubspotExtractionStatus = "ok" | "partial" | "unknown_shape";

export type HubspotNormalizationStatus = "raw_only" | "classified" | "html_only";

export interface HubspotNodeProvenance {
  hubspotHsId: string;
  hubspotKind: HubspotContentKind;
  sourcePath: string;
  parentNodeId?: string;
  extractionStatus: HubspotExtractionStatus;
  normalizationStatus: HubspotNormalizationStatus;
}

export interface HubspotSourceNode {
  id: string;
  sourcePath: string;
  nodeKind: HubspotSourceNodeKind;
  hubspot?: {
    moduleId?: string;
    moduleType?: string;
    definitionId?: string;
    label?: string;
  };
  /** Raw HubSpot object slice for this node (unknown keys preserved). */
  payload: JsonValue;
  htmlFragments: { field: string; value: string }[];
  children: HubspotSourceNode[];
  provenance: HubspotNodeProvenance;
  unsupported?: { paths: string[]; notes?: string };
}

export type HubspotContentRegionKind =
  | "layout_sections"
  | "widget_containers"
  | "html_body";

export interface HubspotContentRegion {
  kind: HubspotContentRegionKind;
  /** Root nodes for this region (order preserved). */
  nodes: HubspotSourceNode[];
}

export type HubspotDiagnosticSeverity = "info" | "warning";

export interface HubspotExtractionDiagnostic {
  code: string;
  severity: HubspotDiagnosticSeverity;
  message: string;
  path?: string;
  hubspotType?: string;
}

export interface HubspotDiscoveredAsset {
  url: string;
  discoveredAtPath: string;
  /** Query/hash-stripped URL used for deduplication. */
  normalizedUrl: string;
  /** Stable key reused across pages and import runs. */
  identityKey: string;
  /** HubSpot hubfs file segment when derivable from the URL. */
  hubspotFileId?: string;
  /** When set, asset was discovered from a responsive/srcset field (still migrated by URL identity). */
  role?: "responsive_variant";
}

export interface HubspotUniversalPageMetadata {
  title: HubspotFieldValue<string>;
  slug: HubspotFieldValue<string>;
  htmlTitle: HubspotFieldValue<string>;
  metaDescription: HubspotFieldValue<string>;
  url: HubspotFieldValue<string>;
  language: HubspotFieldValue<string>;
  publishState: HubspotFieldValue<string>;
  updatedAt: HubspotFieldValue<string>;
  publishDate: HubspotFieldValue<string>;
  featuredImage: HubspotFieldValue<string>;
  authorName: HubspotFieldValue<string>;
  tagIds: HubspotFieldValue<number[]>;
}

export interface HubspotUniversalPageSource {
  kind: HubspotContentKind;
  hsId: string;
  /** ISO timestamp when extraction ran (caller-supplied for determinism in tests). */
  extractedAtIso: string;
}

/** Concatenated HTML parts mirroring {@link normalizeHubspotContent} precedence inputs. */
export interface HubspotLegacyHtmlParts {
  postBody?: string;
  html?: string;
  body?: string;
  layoutHtml: string;
  widgetHtml: string;
}

export interface HubspotUniversalPage {
  modelVersion: typeof HUBSPOT_UNIVERSAL_PAGE_MODEL_VERSION;
  source: HubspotUniversalPageSource;
  metadata: HubspotUniversalPageMetadata;
  regions: HubspotContentRegion[];
  /** Lossless HubSpot API object (stable key order applied at canonicalization). */
  sourceRecord: JsonValue;
  assets: HubspotDiscoveredAsset[];
  diagnostics: HubspotExtractionDiagnostic[];
  legacyHtmlParts: HubspotLegacyHtmlParts;
  /** SHA-256 hex of canonical JSON (excluding digest field). */
  digest: string;
}

export interface ExtractHubspotUniversalPageInput {
  raw: Record<string, unknown>;
  kind: HubspotContentKind;
  hsId: string;
  extractedAtIso: string;
}
