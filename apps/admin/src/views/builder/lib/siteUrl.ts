import type { Site } from "@ob-cms/shared";

/**
 * Environment-configured renderer origin for non-production environments.
 *
 * In local dev (where `VITE_PLATFORM_BASE_DOMAIN` is unset) all tenant sites are
 * served from a single renderer host (e.g. http://localhost:3000). This lets the
 * Admin build "View published" / canvas-link URLs without hardcoding a host when
 * no platform base domain is configured.
 *
 * When `VITE_PLATFORM_BASE_DOMAIN` IS set (any environment, including UAT), the
 * platform-derived per-tenant URL takes priority over this shared origin — see
 * siteOriginUrl. Read inside the function so it can be overridden in tests.
 * In production builds Vite statically inlines the build-time value.
 */
const getRendererBaseUrl = (): string | null => {
  const raw = import.meta.env.VITE_RENDERER_BASE_URL as string | undefined;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
};

/**
 * Platform base domain for multi-tenant subdomain URLs.
 *
 * Reads `VITE_PLATFORM_BASE_DOMAIN` (a build-time VITE_ env var). There is **no
 * hardcoded fallback**: when DevOps leaves it blank or supplies an invalid value,
 * this returns `null` and the Admin emits no platform-derived Published URL.
 *
 * The value is ONLY the base domain — the tenant/site subdomain is always
 * prepended by the app: `https://<subdomain>.<platformBaseDomain>/<slug>`.
 * DevOps controls `VITE_PLATFORM_BASE_DOMAIN`; the application controls the
 * tenant subdomain (site.subdomain).
 *
 * Normalization: trims whitespace, strips an optional http:// or https://
 * scheme, removes trailing slashes, rejects values containing any of
 * / ? # @ or internal whitespace, then validates hostname (and optional port)
 * via the URL API. Explicit `:443` is preserved even though HTTPS normalizes
 * that port to the default before returning a host suitable for
 * `https://<subdomain>.<platformBaseDomain>`.
 */
const MIN_PLATFORM_PORT = 1;
const MAX_PLATFORM_PORT = 65535;
export const HTTPS_DEFAULT_PORT = 443;

const portMatchesParsedUrl = (url: URL, portNum: number): boolean => {
  if (url.port) return Number(url.port) === portNum;
  return portNum === HTTPS_DEFAULT_PORT;
};

const resolveValidPlatformHost = (domain: string): string | null => {
  if (/\s/.test(domain)) return null;
  try {
    const url = new URL(`https://${domain}`);
    if (url.username || url.password) return null;
    if (url.pathname !== "/" && url.pathname !== "") return null;
    if (url.search || url.hash) return null;

    const hostname = url.hostname;
    if (!hostname) return null;

    const domainLower = domain.toLowerCase();
    const hostLower = hostname.toLowerCase();

    if (domainLower === hostLower) return domain;

    const portPrefix = `${hostLower}:`;
    if (!domainLower.startsWith(portPrefix)) return null;

    const explicitPort = domain.slice(hostLower.length + 1);
    if (!/^\d+$/.test(explicitPort)) return null;
    const portNum = Number(explicitPort);
    if (portNum < MIN_PLATFORM_PORT || portNum > MAX_PLATFORM_PORT) return null;
    if (!portMatchesParsedUrl(url, portNum)) return null;

    return `${hostname}:${portNum}`;
  } catch {
    return null;
  }
};

export const getPlatformBaseDomain = (): string | null => {
  const raw = import.meta.env.VITE_PLATFORM_BASE_DOMAIN as string | undefined;
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  let domain = trimmed.replace(/^https?:\/\//i, "");
  domain = domain.replace(/\/+$/, "");
  if (!domain || /[/?#@]/.test(domain)) return null;
  return resolveValidPlatformHost(domain);
};

/**
 * Whether the current build is a staging build.
 *
 * `VITE_ENVIRONMENT` is a build-time Vite variable (see .env.*.example).
 * In staging, siteOriginUrl() fails closed (returns null) when no origin can be
 * derived, instead of generating synthetic tenant URLs.
 */
const isStaging = (): boolean => {
  const env = import.meta.env.VITE_ENVIRONMENT as string | undefined;
  return env === "staging";
};

/**
 * Resolve the public origin (https://host) for a site.
 *
 * Priority (multi-tenant first):
 * 1. `customDomain` — when the site has a dedicated custom domain, that is the
 *    canonical published origin.
 * 2. `https://<subdomain>.<VITE_PLATFORM_BASE_DOMAIN>` — the canonical
 *    multi-tenant published origin. `VITE_PLATFORM_BASE_DOMAIN` is the ONLY
 *    source of the base domain (DevOps-controlled); the tenant/site subdomain is
 *    prepended by the app. Requires both the env var AND a site subdomain.
 * 3. `VITE_RENDERER_BASE_URL` — shared renderer origin, used only as a local-dev
 *    fallback when no platform base domain is configured.
 * 4. **Staging fail-closed**: when `VITE_ENVIRONMENT=staging` and no origin can
 *    be derived, return null instead of emitting a synthetic URL.
 * 5. null — no resolvable origin (no "View published" link rendered).
 */
export const siteOriginUrl = (site: Site | null | undefined): string | null => {
  if (!site) return null;
  if (site.customDomain) return `https://${site.customDomain}`;
  const platformBase = getPlatformBaseDomain();
  if (platformBase && site.subdomain) return `https://${site.subdomain}.${platformBase}`;
  const rendererBase = getRendererBaseUrl();
  if (rendererBase) return rendererBase;
  if (isStaging()) return null;
  return null;
};

/**
 * Build the full public URL for a page path on the given site.
 * e.g. siteOriginUrl(site) + "about" → "https://acme.<platform-base-domain>/about"
 * The homepage (slug "home" or "/") maps to the bare origin.
 */
export const sitePageUrl = (
  site: Site | null | undefined,
  slug: string | undefined,
): string | null => {
  const origin = siteOriginUrl(site);
  if (!origin) return null;
  if (!slug || slug === "home" || slug === "/") return origin;
  return `${origin}/${slug.replace(/^\/+/, "")}`;
};
