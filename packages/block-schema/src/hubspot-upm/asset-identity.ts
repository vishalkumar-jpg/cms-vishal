/** Normalize HubSpot/source URLs for stable deduplication (strip query + hash). */
export const normalizeHubspotAssetUrl = (url: string): string => {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString();
  } catch {
    return trimmed;
  }
};

/** Portal id + full object path after /hubfs/<portalId>/ (may include nested directories). */
const HUBFS_STORAGE_PATH = /\/hubfs\/(\d+)\/([^?#]+)/i;
const HUBSPOT_FILE_ID_QUERY = /[?&]fileId=(\d+)/i;

export const extractHubspotHubfsStoragePath = (
  urlOrPath: string,
): { portalId: string; objectPath: string } | undefined => {
  try {
    const pathname = urlOrPath.startsWith("http") ? new URL(urlOrPath).pathname : urlOrPath;
    const match = pathname.match(HUBFS_STORAGE_PATH);
    if (!match?.[1] || !match[2]) return undefined;
    return { portalId: match[1], objectPath: match[2] };
  } catch {
    const match = urlOrPath.match(HUBFS_STORAGE_PATH);
    if (!match?.[1] || !match[2]) return undefined;
    return { portalId: match[1], objectPath: match[2] };
  }
};

/** Query keys that distinguish responsive/srcset variants of the same hubfs path. */
const RESPONSIVE_SIZE_QUERY_KEYS = ["width", "w", "maxwidth", "max-width", "height", "h", "size"] as const;

const responsiveVariantFingerprint = (searchParams: URLSearchParams): string => {
  const parts: string[] = [];
  for (const key of RESPONSIVE_SIZE_QUERY_KEYS) {
    const value = searchParams.get(key);
    if (value !== null && value.trim().length > 0) parts.push(`${key}=${value.trim()}`);
  }
  return parts.sort().join("&");
};

/**
 * Deterministic identity for deduplication across pages, modules, and import runs.
 * Prefers HubSpot file identifiers when present in the URL.
 * Responsive width/height query variants stay distinct from the same hubfs file path.
 */
export const hubspotAssetIdentityKey = (url: string): string => {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    const fileIdParam = parsed.searchParams.get("fileId") ?? parsed.search.match(HUBSPOT_FILE_ID_QUERY)?.[1];
    const variant = responsiveVariantFingerprint(parsed.searchParams);
    if (fileIdParam) {
      return variant.length > 0
        ? `hubspot:fileId:${fileIdParam}:${variant}`
        : `hubspot:fileId:${fileIdParam}`;
    }
    const hubfs = extractHubspotHubfsStoragePath(parsed.toString());
    if (hubfs) {
      const pathKey = `${hubfs.portalId}/${hubfs.objectPath}`;
      return variant.length > 0 ? `hubspot:hubfs:${pathKey}:${variant}` : `hubspot:hubfs:${pathKey}`;
    }
    parsed.search = variant.length > 0 ? `?${variant}` : "";
    return `url:${parsed.toString()}`;
  } catch {
    const normalized = normalizeHubspotAssetUrl(trimmed);
    const hubfs = extractHubspotHubfsStoragePath(normalized);
    if (hubfs) return `hubspot:hubfs:${hubfs.portalId}/${hubfs.objectPath}`;
    return `url:${normalized}`;
  }
};

const LIKELY_MEDIA_PATH = /\.(png|jpe?g|gif|webp|svg|avif|ico|bmp)(\?|$)/i;

/** True when the URL is likely a binary media asset (not a page or API endpoint). */
export const isLikelyHubspotMediaUrl = (url: string): boolean => {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  if (LIKELY_MEDIA_PATH.test(trimmed)) return true;
  if (/\/hubfs\//i.test(trimmed)) return true;
  if (/\/hs-fs\//i.test(trimmed)) return true;
  if (/hubspotusercontent\.com/i.test(trimmed)) return true;
  if (/\.hubspot\.com\/hubfs\//i.test(trimmed)) return true;
  return false;
};
