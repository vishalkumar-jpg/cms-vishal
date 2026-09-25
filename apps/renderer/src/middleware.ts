import { PUBLIC_API_PREFIX } from "@ob-cms/shared";
import { NextResponse, type NextRequest } from "next/server";
import { isStagingDeployment, STAGING_X_ROBOTS_TAG } from "@/lib/indexing-policy";

/**
 * Public-site middleware. Two jobs:
 *   1. Tenant redirects — check the API's `/api/v1/public/redirect?path=` for the
 *      incoming (host, path); if a redirect matches, issue a 301/302.
 *   2. Security headers (CSP/HSTS/anti-clickjacking) on every response.
 *
 * Runs on the Edge runtime, so it CANNOT use ioredis. Redirect lookups are kept
 * fast via the Next.js fetch data cache (short TTL) — `next: { revalidate }` —
 * which dedupes/caches at the platform layer. The API forwards the Host so the
 * lookup is tenant-scoped. Failures fall through (never block the request).
 */

const API_URL = (process.env.INTERNAL_API_URL || "http://localhost:3001").replace(/\/$/, "");
const REDIRECT_TTL = Number.parseInt(process.env.RENDERER_REDIRECT_TTL ?? "30", 10) || 30;
const NONCE_HEADER = "x-nonce";

/** @ob-cms/blocks loads Google Fonts via `@import` in blocks.css. */
export const GOOGLE_FONTS_STYLESHEET_ORIGIN = "https://fonts.googleapis.com";
export const GOOGLE_FONTS_STATIC_ORIGIN = "https://fonts.gstatic.com";

interface RedirectData {
  toPath: string;
  statusCode: number;
}

function normalizeHost(value: string | null): string {
  if (!value) return "localhost";
  return value.split(",")[0]!.trim().toLowerCase();
}

function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Build the Content-Security-Policy string for public site responses. */
export function buildContentSecurityPolicy(opts?: { nonce?: string; isDev?: boolean }): string {
  const isDev = opts?.isDev ?? process.env.NODE_ENV === "development";
  const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
  const connectSrc = ["'self'", apiOrigin].filter(Boolean).join(" ");
  const nonce = opts?.nonce;

  const scriptSrc = [
    "'self'",
    ...(nonce ? [`'nonce-${nonce}'`, "'strict-dynamic'"] : []),
    ...(isDev ? ["'unsafe-eval'", "'unsafe-inline'"] : []),
  ].join(" ");

  return [
    "default-src 'self'",
    `style-src 'self' 'unsafe-inline' ${GOOGLE_FONTS_STYLESHEET_ORIGIN}`,
    `script-src ${scriptSrc}`,
    "img-src 'self' data: https: blob:",
    "media-src 'self' https: blob:",
    `font-src 'self' data: ${GOOGLE_FONTS_STATIC_ORIGIN}`,
    `connect-src ${connectSrc}`,
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
  ].join("; ");
}

/** Security headers applied to every response. */
function withSecurityHeaders(
  res: NextResponse,
  opts: { nonce: string; isDev: boolean },
): NextResponse {
  const csp = buildContentSecurityPolicy({ nonce: opts.nonce, isDev: opts.isDev });

  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-DNS-Prefetch-Control", "on");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // UAT/staging: block search-engine indexing on every public website response.
  if (isStagingDeployment()) {
    res.headers.set("X-Robots-Tag", STAGING_X_ROBOTS_TAG);
  }
  return res;
}

async function lookupRedirect(host: string, path: string): Promise<RedirectData | null> {
  try {
    const url = `${API_URL}${PUBLIC_API_PREFIX}/redirect?path=${encodeURIComponent(path)}`;
    const res = await fetch(url, {
      headers: { host, "x-forwarded-host": host, accept: "application/json" },
      next: { revalidate: REDIRECT_TTL },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data: RedirectData | null };
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const host = normalizeHost(
    req.headers.get("x-forwarded-host") ?? req.headers.get("host"),
  );
  const path = req.nextUrl.pathname;
  const isDev = process.env.NODE_ENV === "development";
  const nonce = createNonce();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(NONCE_HEADER, nonce);

  // 1. Redirects (skip internal/asset paths handled by the matcher already).
  const redirect = await lookupRedirect(host, path);
  if (redirect && redirect.toPath && redirect.toPath !== path) {
    const status = redirect.statusCode === 302 ? 302 : 301;
    const target = redirect.toPath.startsWith("http")
      ? redirect.toPath
      : new URL(redirect.toPath, req.url);
    return withSecurityHeaders(
      NextResponse.redirect(target, { status, headers: requestHeaders }),
      { nonce, isDev },
    );
  }

  // 2. Pass through with security headers + per-request nonce for App Router.
  return withSecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    { nonce, isDev },
  );
}

export const config = {
  // Skip Next internals, static assets, and the proxied root files so those
  // route handlers serve directly without a redirect round-trip.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/).*)",
  ],
};
