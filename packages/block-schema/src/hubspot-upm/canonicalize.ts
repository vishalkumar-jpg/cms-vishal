import { sortJsonValueKeys, toJsonValue } from "./json-utils";
import { sha256HexFromUtf8 } from "./sha256-hex";
import type { HubspotUniversalPage, JsonValue } from "./types";

export type HubspotUniversalPageCanonical = Omit<HubspotUniversalPage, "digest">;

/** Canonical JSON-safe page without digest (for hashing and snapshots). */
export const canonicalizeHubspotUniversalPage = (
  page: HubspotUniversalPage,
): HubspotUniversalPageCanonical => {
  const { digest: _digest, ...rest } = page;
  return sortJsonValueKeys(toJsonValue(rest) as JsonValue) as unknown as HubspotUniversalPageCanonical;
};

export const hubspotUniversalPageDigest = (page: HubspotUniversalPage): string => {
  const canonical = canonicalizeHubspotUniversalPage(page);
  const json = JSON.stringify(canonical);
  return sha256HexFromUtf8(json);
};

/** Attach digest computed from canonical form (mutates logical output — returns new object). */
export const withHubspotUniversalPageDigest = (
  page: Omit<HubspotUniversalPage, "digest">,
): HubspotUniversalPage => {
  const withPlaceholder = { ...page, digest: "" };
  const digest = hubspotUniversalPageDigest(withPlaceholder as HubspotUniversalPage);
  return { ...page, digest };
};
