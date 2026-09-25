import { afterEach, describe, expect, it } from "bun:test";
import {
  buildContentSecurityPolicy,
  GOOGLE_FONTS_STATIC_ORIGIN,
  GOOGLE_FONTS_STYLESHEET_ORIGIN,
} from "./middleware";

const ORIGINAL_NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL;

afterEach(() => {
  if (ORIGINAL_NEXT_PUBLIC_API_URL === undefined) {
    delete process.env.NEXT_PUBLIC_API_URL;
  } else {
    process.env.NEXT_PUBLIC_API_URL = ORIGINAL_NEXT_PUBLIC_API_URL;
  }
});

describe("buildContentSecurityPolicy", () => {
  it("allows Google Fonts stylesheet and font file origins", () => {
    const csp = buildContentSecurityPolicy({ isDev: false, nonce: "test-nonce" });
    const fontSrc = csp.split("; ").find((directive) => directive.startsWith("font-src "));

    expect(csp).toContain(`style-src 'self' 'unsafe-inline' ${GOOGLE_FONTS_STYLESHEET_ORIGIN}`);
    expect(fontSrc).toBe(`font-src 'self' data: ${GOOGLE_FONTS_STATIC_ORIGIN}`);
  });

  it("keeps restrictive defaults for scripts, objects, and framing", () => {
    const csp = buildContentSecurityPolicy({ isDev: false, nonce: "test-nonce" });

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'nonce-test-nonce' 'strict-dynamic'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toContain("*");
  });

  it("includes the public API origin in connect-src when configured", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://uat-cms-api.officebeacon.net";
    const csp = buildContentSecurityPolicy({ isDev: false, nonce: "test-nonce" });

    expect(csp).toContain("connect-src 'self' https://uat-cms-api.officebeacon.net");
  });

  it("allows dev-only script relaxations without widening style-src", () => {
    const csp = buildContentSecurityPolicy({ isDev: true, nonce: "dev-nonce" });
    const scriptSrc = csp.split("; ").find((directive) => directive.startsWith("script-src "));

    expect(scriptSrc).toBe(
      "script-src 'self' 'nonce-dev-nonce' 'strict-dynamic' 'unsafe-eval' 'unsafe-inline'",
    );
    expect(csp).toContain(`style-src 'self' 'unsafe-inline' ${GOOGLE_FONTS_STYLESHEET_ORIGIN}`);
    expect(scriptSrc).not.toContain(GOOGLE_FONTS_STYLESHEET_ORIGIN);
    expect(scriptSrc).not.toContain(GOOGLE_FONTS_STATIC_ORIGIN);
    expect(csp).not.toContain("*");
  });
});
