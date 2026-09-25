const HUBSPOT_API_HOSTNAMES = new Set(["api.hubapi.com"]);

const HUBSPOT_ASSET_HOST_SUFFIXES = [
  ".hubspot.com",
  ".hubspot.net",
  ".hubspotusercontent.net",
  ".hubspotusercontent-na1.net",
  ".hubspotusercontent-eu1.net",
] as const;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
]);

const PRIVATE_IPV4_PATTERN =
  /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/;

const LINK_LOCAL_IPV6_PATTERN = /^(fe80:|fc00:|fd)/i;

export class HubspotAssetFetchUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HubspotAssetFetchUrlError";
  }
}

const normalizeHostname = (hostname: string): string => hostname.trim().toLowerCase().replace(/\.$/, "");

export const isHubspotApiFetchHostname = (hostname: string): boolean =>
  HUBSPOT_API_HOSTNAMES.has(normalizeHostname(hostname));

const isBlockedHostname = (hostname: string): boolean => {
  const lower = normalizeHostname(hostname);
  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  if (lower.endsWith(".localhost")) return true;
  if (PRIVATE_IPV4_PATTERN.test(lower)) return true;
  if (LINK_LOCAL_IPV6_PATTERN.test(lower)) return true;
  return false;
};

export const isApprovedHubspotAssetFetchHostname = (hostname: string): boolean => {
  const lower = normalizeHostname(hostname);
  if (isBlockedHostname(lower)) return false;
  if (isHubspotApiFetchHostname(lower)) return true;
  return HUBSPOT_ASSET_HOST_SUFFIXES.some((suffix) => lower.endsWith(suffix) || lower === suffix.slice(1));
};

/** Validate a URL before HubSpot asset migration fetch (SSRF guard). */
export const assertApprovedHubspotAssetFetchUrl = (rawUrl: string): URL => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new HubspotAssetFetchUrlError("Asset URL is not a valid HTTP(S) URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new HubspotAssetFetchUrlError("Asset URL must use HTTPS.");
  }
  if (!isApprovedHubspotAssetFetchHostname(parsed.hostname)) {
    throw new HubspotAssetFetchUrlError("Asset URL host is not an approved HubSpot destination.");
  }
  return parsed;
};

export const resolveHubspotAssetRedirectTarget = (currentUrl: URL, locationHeader: string): URL => {
  const resolved = new URL(locationHeader.trim(), currentUrl);
  assertApprovedHubspotAssetFetchUrl(resolved.toString());
  return resolved;
};
