import {
  HUBSPOT_PUBLISHED_STATE,
  type HubspotContentKind,
  type HubspotNormalizedContent,
  type HubspotRawContent,
} from "../hubspot-api";
import type { SerializedLayout } from "../layout";
import { convertHubspotUpmToLayout, hubspotLegacyHtmlEmbedLayout } from "./convert-layout";
import { extractHubspotUniversalPage } from "./extract";
import { deriveLegacyImportHtml } from "./legacy-html";
import {
  rewriteAssetUrlsInHtml,
  rewriteAssetUrlsInSerializedLayout,
} from "./rewrite-asset-references";
import type { HubspotExtractionDiagnostic, HubspotUniversalPage } from "./types";

const normalizedFromUpm = (
  raw: HubspotRawContent,
  upm: HubspotUniversalPage,
): HubspotNormalizedContent => {
  const html = deriveLegacyImportHtml(upm.legacyHtmlParts);
  return {
    name: raw.name ?? raw.htmlTitle ?? "Imported",
    slug: raw.slug,
    html,
    metaDescription: raw.metaDescription,
    htmlTitle: raw.htmlTitle,
    updatedAt: raw.updatedAt ?? raw.updated,
    publishState: raw.state ?? (raw.currentlyPublished ? HUBSPOT_PUBLISHED_STATE : undefined),
    featuredImage: raw.featuredImage,
    publishDate: raw.publishDate,
    authorName: raw.authorName,
    tagIds: raw.tagIds,
    url: raw.url,
    language: raw.language,
  };
};

export const hubspotImportNormalizedFromSource = (
  raw: HubspotRawContent,
  kind: HubspotContentKind,
  hsId: string,
  extractedAtIso: string,
): HubspotNormalizedContent => {
  const upm = extractHubspotUniversalPage({
    raw: raw as Record<string, unknown>,
    kind,
    hsId,
    extractedAtIso,
  });
  return normalizedFromUpm(raw, upm);
};

export interface HubspotScopedImportBundle {
  normalized: HubspotNormalizedContent;
  layout: SerializedLayout;
  hasStructuralLayout: boolean;
  diagnostics: HubspotExtractionDiagnostic[];
}

export interface HubspotScopedImportOptions {
  /** When set, rewrites HubSpot media URLs in layout + legacy HTML to OB URLs. */
  assetUrlMap?: Readonly<Record<string, string>>;
}

const applyAssetUrlMapToBundle = (
  bundle: Omit<HubspotScopedImportBundle, "diagnostics"> & { diagnostics: HubspotExtractionDiagnostic[] },
  assetUrlMap: Readonly<Record<string, string>> | undefined,
): HubspotScopedImportBundle => {
  if (!assetUrlMap || Object.keys(assetUrlMap).length === 0) return bundle;
  return {
    ...bundle,
    normalized: {
      ...bundle.normalized,
      html: rewriteAssetUrlsInHtml(bundle.normalized.html, assetUrlMap),
      featuredImage: bundle.normalized.featuredImage
        ? (assetUrlMap[bundle.normalized.featuredImage] ?? bundle.normalized.featuredImage)
        : undefined,
    },
    layout: rewriteAssetUrlsInSerializedLayout(bundle.layout, assetUrlMap),
  };
};

/** Build import bundle from an already-extracted UPM (J1 asset migration). */
export const hubspotScopedImportFromUpm = (
  upm: HubspotUniversalPage,
  raw: HubspotRawContent,
  options: HubspotScopedImportOptions = {},
): HubspotScopedImportBundle => {
  const normalized = normalizedFromUpm(raw, upm);
  const conversion = convertHubspotUpmToLayout(upm);
  const layout = conversion.hasStructuralLayout
    ? conversion.layout
    : hubspotLegacyHtmlEmbedLayout(normalized.html, upm.source.hsId);
  const base: HubspotScopedImportBundle = {
    normalized,
    layout,
    hasStructuralLayout: conversion.hasStructuralLayout,
    diagnostics: conversion.diagnostics,
  };
  return applyAssetUrlMapToBundle(base, options.assetUrlMap);
};

/** Single UPM extraction + Phase D layout conversion (scoped HubSpot import). */
export const hubspotScopedImportFromSource = (
  raw: HubspotRawContent,
  kind: HubspotContentKind,
  hsId: string,
  extractedAtIso: string,
  options: HubspotScopedImportOptions = {},
): HubspotScopedImportBundle => {
  const upm = extractHubspotUniversalPage({
    raw: raw as Record<string, unknown>,
    kind,
    hsId,
    extractedAtIso,
  });
  return hubspotScopedImportFromUpm(upm, raw, options);
};
