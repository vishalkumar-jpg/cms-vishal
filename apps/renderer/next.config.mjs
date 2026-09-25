/** @type {import('next').NextConfig} */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { config as loadDotenv } from "dotenv";

// WAVE4b env consolidation: load the monorepo-root .env so a single root file
// powers `bun run dev` for the renderer too (Next only auto-loads cwd-local
// .env). Walk up to the first .env; compose-injected env still wins (dotenv
// never overrides already-set values).
(() => {
  let dir = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) {
      loadDotenv({ path: candidate });
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
})();

// Defense-in-depth security headers (the middleware also sets a per-request CSP
// + HSTS for app routes; these cover static/route-handler responses too).
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig = {
  reactStrictMode: true,
  // Transpile the workspace TS packages consumed as source.
  transpilePackages: ["@ob-cms/blocks", "@ob-cms/block-schema", "@ob-cms/shared"],
  // Allow remote block images (S3/CloudFront). Widened for Wave 3a; tighten to
  // the tenant asset hosts in production.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Immutable, long-lived caching for fingerprinted build assets (WAVE4b perf).
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
