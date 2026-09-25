import { collectHttpUrlsFromJson } from "./extract-layout";
import { hubspotAssetIdentityKey, isLikelyHubspotMediaUrl } from "./asset-identity";
import type { HubspotDiscoveredAsset, HubspotUniversalPage } from "./types";

/** Build source URL → OB URL map without collapsing responsive variants onto normalizedUrl. */
export const buildHubspotAssetMigrationUrlMap = (
  upm: HubspotUniversalPage,
  identityToObUrl: ReadonlyMap<string, string> | Record<string, string>,
): Record<string, string> => {
  const identityMap =
    identityToObUrl instanceof Map ? identityToObUrl : new Map(Object.entries(identityToObUrl));
  const urlMap: Record<string, string> = {};
  const collected: { url: string; discoveredAtPath: string }[] = [];
  collectHttpUrlsFromJson(upm.sourceRecord, "", new Set(), collected);
  for (const entry of collected) {
    if (!isLikelyHubspotMediaUrl(entry.url)) continue;
    const obUrl = identityMap.get(hubspotAssetIdentityKey(entry.url));
    if (obUrl) urlMap[entry.url] = obUrl;
  }
  for (const asset of upm.assets) {
    const obUrl = identityMap.get(asset.identityKey);
    if (!obUrl) continue;
    urlMap[asset.url] = obUrl;
    if (asset.identityKey === hubspotAssetIdentityKey(asset.normalizedUrl)) {
      urlMap[asset.normalizedUrl] = obUrl;
    }
  }
  return urlMap;
};
