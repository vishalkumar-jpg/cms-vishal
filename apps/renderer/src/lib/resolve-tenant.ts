import { resolveHost } from "./host";
import { getSite } from "./site-data";
import type { PublicSite } from "./public-api-types";

/**
 * Resolve the tenant/site for the current public request by Host header
 * (subdomain or custom domain) — TECH-ARCHITECTURE §3.1/§3.3.
 *
 * Real implementation (Wave 3a): reads `x-forwarded-host`/`host`, calls
 * `/api/v1/public/site` (React `cache()` + Redis + Next data cache). Returns
 * `null` for an unknown host so the route renders `notFound()`.
 */
export interface ResolvedTenant {
  site: PublicSite;
  host: string;
}

export async function resolveTenant(): Promise<ResolvedTenant | null> {
  const host = await resolveHost();
  const site = await getSite(host);
  if (!site) return null;
  return { site, host };
}
