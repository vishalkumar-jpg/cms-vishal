import { extractHtmlFromLayoutSections, resolveTopLevelBodyHtml } from "../hubspot-api";
import type { HubspotLegacyHtmlParts } from "./types";

const firstNonEmptyHtml = (...candidates: (string | undefined)[]): string => {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return "";
};

const extractWidgetHtml = (w: object): string => {
  const obj = w as Record<string, unknown>;
  if (typeof obj.html === "string") return obj.html;
  if (obj.body && typeof obj.body === "object") {
    const body = obj.body as Record<string, unknown>;
    if (typeof body.html === "string") return body.html;
  }
  return "";
};

/** Build legacy HTML part strings using the same rules as {@link normalizeHubspotContent}. */
export const computeLegacyHtmlPartsFromRaw = (
  raw: Record<string, unknown>,
): HubspotLegacyHtmlParts => {
  const widgetHtml = raw.widgetContainers
    ? Object.values(raw.widgetContainers as Record<string, unknown>)
        .map((w) => (w && typeof w === "object" ? extractWidgetHtml(w) : ""))
        .filter(Boolean)
        .join("\n")
    : "";
  const layoutHtml = raw.layoutSections ? extractHtmlFromLayoutSections(raw.layoutSections) : "";
  return {
    postBody: typeof raw.postBody === "string" ? raw.postBody : undefined,
    html: typeof raw.html === "string" ? raw.html : undefined,
    body: resolveTopLevelBodyHtml(raw),
    layoutHtml,
    widgetHtml,
  };
};

/**
 * Legacy import HTML — same precedence as {@link normalizeHubspotContent}:
 * postBody → html → body → layoutHtml → widgetHtml.
 */
export const deriveLegacyImportHtml = (parts: HubspotLegacyHtmlParts): string =>
  firstNonEmptyHtml(parts.postBody, parts.html, parts.body, parts.layoutHtml, parts.widgetHtml);
