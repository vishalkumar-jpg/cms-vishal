import { collectAssetsFromPageJson } from "./extract-layout";
import {
  extractHubspotHubfsStoragePath,
  hubspotAssetIdentityKey,
  isLikelyHubspotMediaUrl,
  normalizeHubspotAssetUrl,
} from "./asset-identity";
import type { HubspotDiscoveredAsset, HubspotUniversalPage } from "./types";
import type { JsonValue } from "./types";

const enrichAsset = (url: string, discoveredAtPath: string): HubspotDiscoveredAsset => {
  const normalizedUrl = normalizeHubspotAssetUrl(url);
  const identityKey = hubspotAssetIdentityKey(url);
  const hubfsMatch = extractHubspotHubfsStoragePath(normalizedUrl);
  const role =
    discoveredAtPath.includes("/mobile/") || discoveredAtPath.endsWith("@srcset")
      ? ("responsive_variant" as const)
      : undefined;
  return {
    url,
    discoveredAtPath,
    normalizedUrl,
    identityKey,
    hubspotFileId: hubfsMatch ? `${hubfsMatch.portalId}/${hubfsMatch.objectPath}` : undefined,
    ...(role ? { role } : {}),
  };
};

/** Extend JSON-walk discoveries with identity + filter to migratable media URLs. */
export const discoverHubspotMediaAssets = (
  sourceRecord: JsonValue,
): HubspotDiscoveredAsset[] => {
  const raw = collectAssetsFromPageJson(sourceRecord);
  const byIdentity = new Map<string, HubspotDiscoveredAsset>();
  for (const entry of raw) {
    if (!isLikelyHubspotMediaUrl(entry.url)) continue;
    const enriched = enrichAsset(entry.url, entry.discoveredAtPath);
    if (!byIdentity.has(enriched.identityKey)) {
      byIdentity.set(enriched.identityKey, enriched);
    }
  }
  return [...byIdentity.values()].sort(
    (a, b) => a.identityKey.localeCompare(b.identityKey) || a.url.localeCompare(b.url),
  );
};

export const discoverHubspotMediaAssetsFromPage = (upm: HubspotUniversalPage): HubspotDiscoveredAsset[] => {
  const fromRecord = discoverHubspotMediaAssets(upm.sourceRecord);
  const featuredField = upm.metadata.featuredImage;
  const featured =
    featuredField.status === "present" ? featuredField.normalized : undefined;
  if (typeof featured === "string" && isLikelyHubspotMediaUrl(featured)) {
    const enriched = enrichAsset(featured, "/metadata/featuredImage");
    if (!fromRecord.some((a) => a.identityKey === enriched.identityKey)) {
      fromRecord.push(enriched);
      fromRecord.sort((a, b) => a.identityKey.localeCompare(b.identityKey));
    }
  }
  return fromRecord;
};
