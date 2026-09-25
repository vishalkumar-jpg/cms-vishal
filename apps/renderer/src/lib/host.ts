import { headers } from "next/headers";

/**
 * Resolve the public-facing Host for the current request. Behind a CDN/proxy
 * the original host arrives in `x-forwarded-host`; we prefer it and fall back to
 * `host`. The value is forwarded verbatim to the API so it resolves the tenant
 * (subdomain or custom domain) — TECH-ARCHITECTURE §3.1/§3.3.
 */
export async function resolveHost(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-host");
  const host = forwarded ?? h.get("host") ?? "localhost";
  // Take the first value if a comma-separated proxy chain is present.
  return host.split(",")[0]!.trim().toLowerCase();
}

/** Normalize a host value (used by middleware which has the request in hand). */
export function normalizeHost(value: string | null): string {
  if (!value) return "localhost";
  return value.split(",")[0]!.trim().toLowerCase();
}
