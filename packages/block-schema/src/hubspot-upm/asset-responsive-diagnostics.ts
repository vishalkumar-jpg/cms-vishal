import { HUBSPOT_ASSET_MIGRATION_DIAGNOSTIC_CODES } from "./asset-migration-diagnostics";
import type { HubspotExtractionDiagnostic } from "./types";
import type { JsonValue } from "./types";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const nonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const pushUnique = (
  out: HubspotExtractionDiagnostic[],
  seen: Set<string>,
  diagnostic: HubspotExtractionDiagnostic,
): void => {
  const key = `${diagnostic.code}:${diagnostic.path ?? ""}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push(diagnostic);
};

/** Corpus walk: flag HubSpot responsive media the generic Image contract cannot fully consume. */
export const discoverResponsiveAssetDiagnostics = (
  sourceRecord: JsonValue,
): HubspotExtractionDiagnostic[] => {
  const out: HubspotExtractionDiagnostic[] = [];
  const seen = new Set<string>();
  walkJsonForResponsive(sourceRecord, "", out, seen);
  return out;
};

const walkJsonForResponsive = (
  value: JsonValue,
  path: string,
  out: HubspotExtractionDiagnostic[],
  seen: Set<string>,
): void => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkJsonForResponsive(item, `${path}/${index}`, out, seen));
    return;
  }
  if (!isPlainObject(value)) return;

  if (value.picture === true) {
    pushUnique(out, seen, {
      code: HUBSPOT_ASSET_MIGRATION_DIAGNOSTIC_CODES.ASSET_RESPONSIVE_VARIANT_UNSUPPORTED,
      severity: "info",
      message:
        "HubSpot picture/responsive srcset is not mapped to OB Image props; individual asset URLs are still migrated when discovered.",
      path: path || "/",
    });
  }

  const mobile = value.mobile;
  if (isPlainObject(mobile) && isPlainObject(mobile.image) && nonEmptyString(mobile.image.src)) {
    pushUnique(out, seen, {
      code: HUBSPOT_ASSET_MIGRATION_DIAGNOSTIC_CODES.ASSET_RESPONSIVE_VARIANT_UNSUPPORTED,
      severity: "info",
      message:
        "HubSpot mobile image variant is present; OB Image uses desktop src unless a future responsive media contract applies it.",
      path: `${path}/mobile/image/src`,
    });
  }

  for (const key of Object.keys(value).sort()) {
    walkJsonForResponsive(value[key] as JsonValue, `${path}/${key}`, out, seen);
  }
};
