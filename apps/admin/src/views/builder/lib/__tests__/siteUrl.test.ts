import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import type { Site } from "@ob-cms/shared";
import {
  getPlatformBaseDomain,
  HTTPS_DEFAULT_PORT,
  siteOriginUrl,
  sitePageUrl,
} from "@/views/builder/lib/siteUrl";

const RENDERER_KEY = "VITE_RENDERER_BASE_URL";
const PLATFORM_KEY = "VITE_PLATFORM_BASE_DOMAIN";
const ENVIRONMENT_KEY = "VITE_ENVIRONMENT";

const PLATFORM_HOST_EXAMPLE = "example.com";
const HTTPS_DEFAULT_PORT_ZERO_PADDED = "000443";
const PLATFORM_PORT_HTTP_ALT = 80;
const PLATFORM_PORT_HTTP_ALT_ZERO_PADDED = "080";
const PLATFORM_PORT_CUSTOM = 8443;
const PLATFORM_PORT_OUT_OF_RANGE = 99999;
const LOCAL_RENDERER_ORIGIN = "http://localhost:3000";
const TENANT_SUBDOMAIN_ACME = "acme";

const makeSite = (overrides: Partial<Site> = {}): Site =>
  ({
    id: "sit_test",
    tenantId: "ten_test",
    name: "Test Site",
    subdomain: "test",
    customDomain: null,
    status: "active",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  }) as Site;

const withEnv = (key: string, value: string | undefined) => {
  const prev = (import.meta.env as Record<string, unknown>)[key];
  Object.defineProperty(import.meta.env, key, {
    value,
    configurable: true,
    writable: true,
  });
  return () => {
    Object.defineProperty(import.meta.env, key, {
      value: prev,
      configurable: true,
      writable: true,
    });
  };
};

const withRendererEnv = (value: string | undefined) => withEnv(RENDERER_KEY, value);
const withPlatformEnv = (value: string | undefined) => withEnv(PLATFORM_KEY, value);
const withEnvironmentEnv = (value: string | undefined) => withEnv(ENVIRONMENT_KEY, value);

describe("getPlatformBaseDomain", () => {
  let restore: (() => void) | undefined;

  beforeEach(() => {
    restore?.();
    restore = withPlatformEnv(undefined);
  });
  afterEach(() => {
    restore?.();
    restore = undefined;
  });

  it("returns null when env var is missing (undefined)", () => {
    restore?.();
    restore = withPlatformEnv(undefined);
    expect(getPlatformBaseDomain()).toBe(null);
  });

  it("returns null when env var is blank", () => {
    restore?.();
    restore = withPlatformEnv("");
    expect(getPlatformBaseDomain()).toBe(null);
  });

  it("returns null when env var is whitespace only", () => {
    restore?.();
    restore = withPlatformEnv("   ");
    expect(getPlatformBaseDomain()).toBe(null);
  });

  it("passes through a normal domain unchanged", () => {
    restore?.();
    restore = withPlatformEnv("my-company.app");
    expect(getPlatformBaseDomain()).toBe("my-company.app");
  });

  it("trims surrounding whitespace", () => {
    restore?.();
    restore = withPlatformEnv("  my-company.app  ");
    expect(getPlatformBaseDomain()).toBe("my-company.app");
  });

  it("strips a single trailing slash", () => {
    restore?.();
    restore = withPlatformEnv("my-company.app/");
    expect(getPlatformBaseDomain()).toBe("my-company.app");
  });

  it("strips multiple trailing slashes", () => {
    restore?.();
    restore = withPlatformEnv("my-company.app///");
    expect(getPlatformBaseDomain()).toBe("my-company.app");
  });

  it("strips https:// scheme", () => {
    restore?.();
    restore = withPlatformEnv("https://my-company.app");
    expect(getPlatformBaseDomain()).toBe("my-company.app");
  });

  it("strips http:// scheme", () => {
    restore?.();
    restore = withPlatformEnv("http://my-company.app");
    expect(getPlatformBaseDomain()).toBe("my-company.app");
  });

  it("strips scheme and trailing slash together", () => {
    restore?.();
    restore = withPlatformEnv("https://my-company.app/");
    expect(getPlatformBaseDomain()).toBe("my-company.app");
  });

  it("strips scheme and trailing slashes together", () => {
    restore?.();
    restore = withPlatformEnv("http://my-company.app///");
    expect(getPlatformBaseDomain()).toBe("my-company.app");
  });

  it("strips uppercase HTTPS scheme", () => {
    restore?.();
    restore = withPlatformEnv("HTTPS://my-company.app");
    expect(getPlatformBaseDomain()).toBe("my-company.app");
  });

  it("rejects a domain with a path component", () => {
    restore?.();
    restore = withPlatformEnv("my-company.app/path");
    expect(getPlatformBaseDomain()).toBe(null);
  });

  it("rejects a domain with a path after scheme", () => {
    restore?.();
    restore = withPlatformEnv("https://my-company.app/path");
    expect(getPlatformBaseDomain()).toBe(null);
  });

  it("rejects a leading-slash value", () => {
    restore?.();
    restore = withPlatformEnv("/foo");
    expect(getPlatformBaseDomain()).toBe(null);
  });

  it("rejects scheme-only value", () => {
    restore?.();
    restore = withPlatformEnv("https://");
    expect(getPlatformBaseDomain()).toBe(null);
  });

  it("rejects http scheme-only value", () => {
    restore?.();
    restore = withPlatformEnv("http://");
    expect(getPlatformBaseDomain()).toBe(null);
  });

  it("rejects a bare path", () => {
    restore?.();
    restore = withPlatformEnv("foo/bar");
    expect(getPlatformBaseDomain()).toBe(null);
  });

  it("rejects double-slash path", () => {
    restore?.();
    restore = withPlatformEnv("foo//bar");
    expect(getPlatformBaseDomain()).toBe(null);
  });

  it("rejects a domain with a query string", () => {
    restore?.();
    restore = withPlatformEnv("example.com?preview=1");
    expect(getPlatformBaseDomain()).toBe(null);
  });

  it("rejects a domain with a fragment", () => {
    restore?.();
    restore = withPlatformEnv("example.com#preview");
    expect(getPlatformBaseDomain()).toBe(null);
  });

  it("rejects a domain with user-info", () => {
    restore?.();
    restore = withPlatformEnv("user@example.com");
    expect(getPlatformBaseDomain()).toBe(null);
  });

  it("accepts a domain with a port", () => {
    restore?.();
    restore = withPlatformEnv(`${PLATFORM_HOST_EXAMPLE}:${PLATFORM_PORT_CUSTOM}`);
    expect(getPlatformBaseDomain()).toBe(`${PLATFORM_HOST_EXAMPLE}:${PLATFORM_PORT_CUSTOM}`);
  });

  it("preserves an explicit https port 443", () => {
    restore?.();
    restore = withPlatformEnv(`${PLATFORM_HOST_EXAMPLE}:${HTTPS_DEFAULT_PORT}`);
    expect(getPlatformBaseDomain()).toBe(`${PLATFORM_HOST_EXAMPLE}:${HTTPS_DEFAULT_PORT}`);
  });

  it("normalizes a zero-padded https port 443", () => {
    restore?.();
    restore = withPlatformEnv(`${PLATFORM_HOST_EXAMPLE}:${HTTPS_DEFAULT_PORT_ZERO_PADDED}`);
    expect(getPlatformBaseDomain()).toBe(`${PLATFORM_HOST_EXAMPLE}:${HTTPS_DEFAULT_PORT}`);
  });

  it("normalizes a zero-padded port to its canonical numeric value", () => {
    restore?.();
    restore = withPlatformEnv(`${PLATFORM_HOST_EXAMPLE}:${PLATFORM_PORT_HTTP_ALT_ZERO_PADDED}`);
    expect(getPlatformBaseDomain()).toBe(`${PLATFORM_HOST_EXAMPLE}:${PLATFORM_PORT_HTTP_ALT}`);
  });

  it("rejects a malformed port", () => {
    restore?.();
    restore = withPlatformEnv("example.com:bad");
    expect(getPlatformBaseDomain()).toBe(null);
  });

  it("rejects an out-of-range port", () => {
    restore?.();
    restore = withPlatformEnv(`${PLATFORM_HOST_EXAMPLE}:${PLATFORM_PORT_OUT_OF_RANGE}`);
    expect(getPlatformBaseDomain()).toBe(null);
  });

  it("rejects internal whitespace in the hostname", () => {
    restore?.();
    restore = withPlatformEnv("example .com");
    expect(getPlatformBaseDomain()).toBe(null);
  });

  it("accepts a multi-level subdomain", () => {
    restore?.();
    restore = withPlatformEnv("sub.example.com");
    expect(getPlatformBaseDomain()).toBe("sub.example.com");
  });

  it("preserves a normal valid domain", () => {
    restore?.();
    restore = withPlatformEnv("my-company.app");
    expect(getPlatformBaseDomain()).toBe("my-company.app");
  });
});

describe("siteOriginUrl — staging fail-closed", () => {
  let restoreRenderer: (() => void) | undefined;
  let restorePlatform: (() => void) | undefined;
  let restoreEnv: (() => void) | undefined;

  beforeEach(() => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv(undefined);
    restorePlatform?.();
    restorePlatform = withPlatformEnv(undefined);
    restoreEnv?.();
    restoreEnv = withEnvironmentEnv("staging");
  });
  afterEach(() => {
    restoreRenderer?.();
    restoreRenderer = undefined;
    restorePlatform?.();
    restorePlatform = undefined;
    restoreEnv?.();
    restoreEnv = undefined;
  });

  it("staging + missing renderer URL => null (fail closed)", () => {
    const site = makeSite({ customDomain: null, subdomain: "myapp" });
    expect(siteOriginUrl(site)).toBe(null);
  });

  it("staging + invalid renderer URL => null (fail closed)", () => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv("not-a-url");
    const site = makeSite({ customDomain: null, subdomain: "myapp" });
    expect(siteOriginUrl(site)).toBe(null);
  });

  it("staging + valid renderer URL => renderer URL", () => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv("https://uat-cms.officebeacon.net");
    const site = makeSite({ customDomain: null, subdomain: "myapp" });
    expect(siteOriginUrl(site)).toBe("https://uat-cms.officebeacon.net");
  });

  it("staging + custom domain => custom domain (priority preserved)", () => {
    const site = makeSite({ customDomain: "acme.com", subdomain: "test" });
    expect(siteOriginUrl(site)).toBe("https://acme.com");
  });

  it("staging + platform base domain still yields the per-tenant URL", () => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv("not-a-url");
    restorePlatform?.();
    restorePlatform = withPlatformEnv("uat-cms.officebeacon.net");
    const site = makeSite({ customDomain: null, subdomain: "acme" });
    expect(siteOriginUrl(site)).toBe("https://acme.uat-cms.officebeacon.net");
  });
});

describe("siteOriginUrl", () => {
  let restoreRenderer: (() => void) | undefined;
  let restorePlatform: (() => void) | undefined;
  let restoreEnv: (() => void) | undefined;

  beforeEach(() => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv(undefined);
    restorePlatform?.();
    restorePlatform = withPlatformEnv(undefined);
    restoreEnv?.();
    restoreEnv = withEnvironmentEnv(undefined);
  });
  afterEach(() => {
    restoreRenderer?.();
    restoreRenderer = undefined;
    restorePlatform?.();
    restorePlatform = undefined;
    restoreEnv?.();
    restoreEnv = undefined;
  });

  it("returns null for null/undefined site", () => {
    expect(siteOriginUrl(null)).toBe(null);
    expect(siteOriginUrl(undefined)).toBe(null);
  });

  it("prefers customDomain over everything else", () => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv("https://uat-cms.officebeacon.net");
    restorePlatform?.();
    restorePlatform = withPlatformEnv("my-platform.com");
    const site = makeSite({ customDomain: "acme.com", subdomain: "test" });
    expect(siteOriginUrl(site)).toBe("https://acme.com");
  });

  it("uses VITE_RENDERER_BASE_URL when no customDomain (UAT)", () => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv("https://uat-cms.officebeacon.net");
    const site = makeSite({ customDomain: null, subdomain: "myapp" });
    expect(siteOriginUrl(site)).toBe("https://uat-cms.officebeacon.net");
  });

  it("uses VITE_RENDERER_BASE_URL when no customDomain (local)", () => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv("http://localhost:3000");
    const site = makeSite({ customDomain: null, subdomain: "myapp" });
    expect(siteOriginUrl(site)).toBe("http://localhost:3000");
  });

  it("strips trailing slash from VITE_RENDERER_BASE_URL", () => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv("https://uat-cms.officebeacon.net/");
    const site = makeSite({ customDomain: null, subdomain: "myapp" });
    expect(siteOriginUrl(site)).toBe("https://uat-cms.officebeacon.net");
  });

  it("returns null when neither platform base domain nor renderer origin is configured", () => {
    const site = makeSite({ customDomain: null, subdomain: "myapp" });
    expect(siteOriginUrl(site)).toBe(null);
  });

  it("uses VITE_PLATFORM_BASE_DOMAIN for multi-tenant URL when VITE_RENDERER_BASE_URL is unset", () => {
    restorePlatform?.();
    restorePlatform = withPlatformEnv("my-company.app");
    const site = makeSite({ customDomain: null, subdomain: "myapp" });
    expect(siteOriginUrl(site)).toBe("https://myapp.my-company.app");
  });

  it("returns null when VITE_PLATFORM_BASE_DOMAIN is blank (no hardcoded default)", () => {
    restorePlatform?.();
    restorePlatform = withPlatformEnv("");
    const site = makeSite({ customDomain: null, subdomain: "myapp" });
    expect(siteOriginUrl(site)).toBe(null);
  });

  it("falls back to VITE_RENDERER_BASE_URL when platform domain is invalid", () => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv("http://localhost:3000");
    restorePlatform?.();
    restorePlatform = withPlatformEnv("https://bad/path");
    const site = makeSite({ customDomain: null, subdomain: "myapp" });
    expect(siteOriginUrl(site)).toBe("http://localhost:3000");
  });

  it("does not emit a platform URL when the platform domain has a malformed port", () => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv("http://localhost:3000");
    restorePlatform?.();
    restorePlatform = withPlatformEnv("example.com:bad");
    const site = makeSite({ customDomain: null, subdomain: "myapp" });
    expect(siteOriginUrl(site)).toBe("http://localhost:3000");
    expect(siteOriginUrl(site)).not.toContain(":bad");
  });

  it("uses platform tenant URL with explicit port 443 instead of renderer fallback", () => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv(LOCAL_RENDERER_ORIGIN);
    restorePlatform?.();
    restorePlatform = withPlatformEnv(`${PLATFORM_HOST_EXAMPLE}:${HTTPS_DEFAULT_PORT}`);
    const site = makeSite({ customDomain: null, subdomain: TENANT_SUBDOMAIN_ACME });
    expect(siteOriginUrl(site)).toBe(`https://${TENANT_SUBDOMAIN_ACME}.${PLATFORM_HOST_EXAMPLE}:${HTTPS_DEFAULT_PORT}`);
    expect(siteOriginUrl(site)).not.toBe(LOCAL_RENDERER_ORIGIN);
  });

  it("uses normalized zero-padded port 443 for tenant Published URL", () => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv(LOCAL_RENDERER_ORIGIN);
    restorePlatform?.();
    restorePlatform = withPlatformEnv(`${PLATFORM_HOST_EXAMPLE}:${HTTPS_DEFAULT_PORT_ZERO_PADDED}`);
    const site = makeSite({ customDomain: null, subdomain: TENANT_SUBDOMAIN_ACME });
    expect(siteOriginUrl(site)).toBe(`https://${TENANT_SUBDOMAIN_ACME}.${PLATFORM_HOST_EXAMPLE}:${HTTPS_DEFAULT_PORT}`);
  });

  it("uses normalized zero-padded port 80 for tenant Published URL", () => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv(LOCAL_RENDERER_ORIGIN);
    restorePlatform?.();
    restorePlatform = withPlatformEnv(`${PLATFORM_HOST_EXAMPLE}:${PLATFORM_PORT_HTTP_ALT_ZERO_PADDED}`);
    const site = makeSite({ customDomain: null, subdomain: TENANT_SUBDOMAIN_ACME });
    expect(siteOriginUrl(site)).toBe(`https://${TENANT_SUBDOMAIN_ACME}.${PLATFORM_HOST_EXAMPLE}:${PLATFORM_PORT_HTTP_ALT}`);
  });

  it("prefers the platform base domain over a shadowed shared renderer origin", () => {
    // Mirrors the local Docker setup: DevOps sets VITE_PLATFORM_BASE_DOMAIN
    // (uat-cms.officebeacon.net) while VITE_RENDERER_BASE_URL may be shadowed
    // to a shared host (e.g. http://localhost:3000). The per-tenant subdomain
    // URL must win because VITE_PLATFORM_BASE_DOMAIN is the source of truth.
    restoreRenderer?.();
    restoreRenderer = withRendererEnv("http://localhost:3000");
    restorePlatform?.();
    restorePlatform = withPlatformEnv("uat-cms.officebeacon.net");
    const site = makeSite({ customDomain: null, subdomain: "myapp" });
    expect(siteOriginUrl(site)).toBe("https://myapp.uat-cms.officebeacon.net");
  });

  it("supports multiple tenant subdomains with the same platform domain", () => {
    restorePlatform?.();
    restorePlatform = withPlatformEnv("my-company.app");
    const siteA = makeSite({ customDomain: null, subdomain: "officebeacon" });
    const siteB = makeSite({ customDomain: null, subdomain: "acme" });
    expect(siteOriginUrl(siteA)).toBe("https://officebeacon.my-company.app");
    expect(siteOriginUrl(siteB)).toBe("https://acme.my-company.app");
    expect(siteOriginUrl(siteA)).not.toBe(siteOriginUrl(siteB));
  });

  it("returns null when platform domain set but site has no subdomain", () => {
    restorePlatform?.();
    restorePlatform = withPlatformEnv("my-company.app");
    const site = makeSite({ customDomain: null, subdomain: "" });
    expect(siteOriginUrl(site)).toBe(null);
  });

  it("always uses https for customDomain", () => {
    const site = makeSite({ customDomain: "example.com", subdomain: "test" });
    expect(siteOriginUrl(site)!.startsWith("https://")).toBe(true);
  });

  it("ignores invalid VITE_RENDERER_BASE_URL when no platform domain (returns null)", () => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv("not-a-url");
    const site = makeSite({ customDomain: null, subdomain: "myapp" });
    expect(siteOriginUrl(site)).toBe(null);
  });

  it("ignores invalid VITE_RENDERER_BASE_URL and uses VITE_PLATFORM_BASE_DOMAIN", () => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv("not-a-url");
    restorePlatform?.();
    restorePlatform = withPlatformEnv("my-company.app");
    const site = makeSite({ customDomain: null, subdomain: "myapp" });
    expect(siteOriginUrl(site)).toBe("https://myapp.my-company.app");
  });

  it("accepts https:// protocol for VITE_RENDERER_BASE_URL", () => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv("https://example.com");
    const site = makeSite({ customDomain: null, subdomain: "myapp" });
    expect(siteOriginUrl(site)).toBe("https://example.com");
  });

  it("accepts http:// protocol for VITE_RENDERER_BASE_URL", () => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv("http://example.com");
    const site = makeSite({ customDomain: null, subdomain: "myapp" });
    expect(siteOriginUrl(site)).toBe("http://example.com");
  });

  it("rejects non-http(s) protocols and returns null when no platform domain", () => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv("ftp://example.com");
    const site = makeSite({ customDomain: null, subdomain: "myapp" });
    expect(siteOriginUrl(site)).toBe(null);
  });

  it("rejects non-http(s) protocols and uses VITE_PLATFORM_BASE_DOMAIN", () => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv("ftp://example.com");
    restorePlatform?.();
    restorePlatform = withPlatformEnv("my-company.app");
    const site = makeSite({ customDomain: null, subdomain: "myapp" });
    expect(siteOriginUrl(site)).toBe("https://myapp.my-company.app");
  });

  it("does not leak localhost into multi-tenant URLs", () => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv(undefined);
    restorePlatform?.();
    restorePlatform = withPlatformEnv("my-company.app");
    const site = makeSite({ customDomain: null, subdomain: "officebeacon" });
    const url = siteOriginUrl(site);
    expect(url).not.toContain("localhost");
    expect(url).not.toContain("127.0.0.1");
    expect(url).toBe("https://officebeacon.my-company.app");
  });
});

describe("sitePageUrl", () => {
  let restoreRenderer: (() => void) | undefined;
  let restorePlatform: (() => void) | undefined;
  let restoreEnv: (() => void) | undefined;

  beforeEach(() => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv("https://uat-cms.officebeacon.net");
    restorePlatform?.();
    restorePlatform = withPlatformEnv(undefined);
    restoreEnv?.();
    restoreEnv = withEnvironmentEnv(undefined);
  });
  afterEach(() => {
    restoreRenderer?.();
    restoreRenderer = undefined;
    restorePlatform?.();
    restorePlatform = undefined;
    restoreEnv?.();
    restoreEnv = undefined;
  });

  it("returns null for null/undefined site", () => {
    expect(sitePageUrl(null, "about")).toBe(null);
    expect(sitePageUrl(undefined, undefined)).toBe(null);
  });

  it("returns bare origin for homepage slug", () => {
    const site = makeSite({ subdomain: "myapp" });
    expect(sitePageUrl(site, "home")).toBe("https://uat-cms.officebeacon.net");
  });

  it("returns bare origin for empty slug", () => {
    const site = makeSite({ subdomain: "myapp" });
    expect(sitePageUrl(site, "")).toBe("https://uat-cms.officebeacon.net");
  });

  it("returns bare origin for undefined slug", () => {
    const site = makeSite({ subdomain: "myapp" });
    expect(sitePageUrl(site, undefined)).toBe("https://uat-cms.officebeacon.net");
  });

  it("returns bare origin for homepage slash slug", () => {
    const site = makeSite({ subdomain: "test" });
    expect(sitePageUrl(site, "/")).toBe("https://uat-cms.officebeacon.net");
  });

  it("appends the page slug for non-homepage pages", () => {
    const site = makeSite({ subdomain: "myapp" });
    expect(sitePageUrl(site, "about")).toBe("https://uat-cms.officebeacon.net/about");
  });

  it("uses customDomain when set (takes precedence over env base URL)", () => {
    const site = makeSite({ customDomain: "acme.com", subdomain: "test" });
    expect(sitePageUrl(site, "about")).toBe("https://acme.com/about");
  });

  it("uses the per-tenant platform subdomain when env renderer is unset", () => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv(undefined);
    restorePlatform?.();
    restorePlatform = withPlatformEnv("uat-cms.officebeacon.net");
    const site = makeSite({ subdomain: "acme" });
    expect(sitePageUrl(site, "about")).toBe("https://acme.uat-cms.officebeacon.net/about");
    expect(sitePageUrl(site, "home")).toBe("https://acme.uat-cms.officebeacon.net");
  });

  it("returns null when neither platform domain nor renderer origin is configured", () => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv(undefined);
    const site = makeSite({ subdomain: "myapp" });
    expect(sitePageUrl(site, "about")).toBe(null);
    expect(sitePageUrl(site, "home")).toBe(null);
  });

  it("uses custom platform domain in production fallback", () => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv(undefined);
    restorePlatform?.();
    restorePlatform = withPlatformEnv("my-company.app");
    const site = makeSite({ subdomain: "myapp" });
    expect(sitePageUrl(site, "about")).toBe("https://myapp.my-company.app/about");
    expect(sitePageUrl(site, "home")).toBe("https://myapp.my-company.app");
  });

  it("produces distinct per-tenant URLs for distinct tenants (acme vs officebeacon)", () => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv(undefined);
    restorePlatform?.();
    restorePlatform = withPlatformEnv("uat-cms.officebeacon.net");
    const siteA = makeSite({ subdomain: "officebeacon" });
    const siteB = makeSite({ subdomain: "acme" });
    const urlA = sitePageUrl(siteA, "about");
    const urlB = sitePageUrl(siteB, "about");
    expect(urlA).toBe("https://officebeacon.uat-cms.officebeacon.net/about");
    expect(urlB).toBe("https://acme.uat-cms.officebeacon.net/about");
    expect(urlA).not.toBe(urlB);
  });

  it("produces identical URLs for the same tenant when only the shared renderer is configured", () => {
    const siteA = makeSite({ subdomain: "officebeacon" });
    const siteB = makeSite({ subdomain: "acme" });
    expect(sitePageUrl(siteA, "about")).toBe("https://uat-cms.officebeacon.net/about");
    expect(sitePageUrl(siteB, "about")).toBe("https://uat-cms.officebeacon.net/about");
  });

  it("does not produce double slashes in slug path", () => {
    const site = makeSite({ subdomain: "myapp" });
    expect(sitePageUrl(site, "/about")).toBe("https://uat-cms.officebeacon.net/about");
  });

  it("does not leak localhost in production fallback", () => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv(undefined);
    restorePlatform?.();
    restorePlatform = withPlatformEnv("my-company.app");
    const site = makeSite({ subdomain: "myapp" });
    const url = sitePageUrl(site, "about");
    expect(url).not.toContain("localhost");
    expect(url).toBe("https://myapp.my-company.app/about");
  });

  it("staging + missing renderer URL => null (fail closed)", () => {
    restoreRenderer?.();
    restoreRenderer = withRendererEnv(undefined);
    restoreEnv?.();
    restoreEnv = withEnvironmentEnv("staging");
    const site = makeSite({ subdomain: "myapp" });
    expect(sitePageUrl(site, "about")).toBe(null);
  });
});
