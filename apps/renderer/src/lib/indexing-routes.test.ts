import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { NextRequest } from "next/server";
import { GET as blogRssGet } from "../app/blog/rss.xml/route";
import { GET as feedAtomGet } from "../app/feed.atom/route";
import { GET as feedXmlGet } from "../app/feed.xml/route";
import { GET as robotsGet } from "../app/robots.txt/route";
import { GET as sitemapGet } from "../app/sitemap.xml/route";
import { feedResponse } from "./feed-response";
import { STAGING_X_ROBOTS_TAG } from "./indexing-policy";

const ORIGINAL_ENVIRONMENT = process.env.ENVIRONMENT;
const ORIGINAL_FETCH = globalThis.fetch;

const STAGING_CACHE_CONTROL = "private, no-store";

const SAMPLE_SITEMAP_XML =
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://example.com/</loc>\n  </url>\n</urlset>\n';

afterEach(() => {
  if (ORIGINAL_ENVIRONMENT === undefined) {
    delete process.env.ENVIRONMENT;
  } else {
    process.env.ENVIRONMENT = ORIGINAL_ENVIRONMENT;
  }
  globalThis.fetch = ORIGINAL_FETCH;
});

function makeRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`);
}

function expectStagingProtectionHeaders(res: Response): void {
  expect(res.headers.get("X-Robots-Tag")).toBe(STAGING_X_ROBOTS_TAG);
  expect(res.headers.get("cache-control")).toBe(STAGING_CACHE_CONTROL);
}

describe("UAT indexing route handlers", () => {
  describe("staging", () => {
    beforeEach(() => {
      process.env.ENVIRONMENT = "staging";
    });

    it("robots.txt blocks all crawlers with no sitemap reference", async () => {
      const res = await robotsGet(makeRequest("/robots.txt"));
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("Disallow: /");
      expect(body.toLowerCase()).not.toContain("sitemap");
      expect(
        body.split("\n").some((line) => /^\s*allow\s*:/i.test(line)),
      ).toBe(false);
      expectStagingProtectionHeaders(res);
    });

    it("sitemap.xml returns 404 with X-Robots-Tag without proxying upstream", async () => {
      const fetchMock = mock(async () => {
        throw new Error("fetch must not be called on staging sitemap");
      });
      globalThis.fetch = fetchMock as typeof fetch;

      const res = await sitemapGet(makeRequest("/sitemap.xml"));
      expect(res.status).toBe(404);
      expect(await res.text()).toBe("Not found");
      expectStagingProtectionHeaders(res);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("RSS feed returns 404 with X-Robots-Tag on staging", async () => {
      const res = await feedResponse(makeRequest("/feed.xml"), "rss");
      expect(res.status).toBe(404);
      expectStagingProtectionHeaders(res);
    });

    it("Atom feed returns 404 with X-Robots-Tag on staging", async () => {
      const res = await feedResponse(makeRequest("/feed.atom"), "atom");
      expect(res.status).toBe(404);
      expectStagingProtectionHeaders(res);
    });

    it("feed.xml route returns 404 with staging protection headers", async () => {
      const res = await feedXmlGet(makeRequest("/feed.xml"));
      expect(res.status).toBe(404);
      expectStagingProtectionHeaders(res);
    });

    it("feed.atom route returns 404 with staging protection headers", async () => {
      const res = await feedAtomGet(makeRequest("/feed.atom"));
      expect(res.status).toBe(404);
      expectStagingProtectionHeaders(res);
    });

    it("blog RSS route returns 404 with X-Robots-Tag on staging", async () => {
      const res = await blogRssGet(makeRequest("/blog/rss.xml"));
      expect(res.status).toBe(404);
      expectStagingProtectionHeaders(res);
    });
  });

  describe("production", () => {
    beforeEach(() => {
      process.env.ENVIRONMENT = "production";
    });

    it("robots.txt uses unreachable-API fallback when upstream fetch fails", async () => {
      globalThis.fetch = mock(async () => {
        throw new Error("Connection refused");
      }) as typeof fetch;

      const res = await robotsGet(makeRequest("/robots.txt"));
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("Allow: /");
      expect(body).not.toContain("Disallow: /");
      expect(res.headers.get("X-Robots-Tag")).toBeNull();
    });

    it("sitemap.xml proxies a successful upstream response in production", async () => {
      globalThis.fetch = mock(async () =>
        new Response(SAMPLE_SITEMAP_XML, {
          status: 200,
          headers: { "content-type": "application/xml; charset=utf-8" },
        }),
      ) as typeof fetch;

      const res = await sitemapGet(makeRequest("/sitemap.xml"));
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(SAMPLE_SITEMAP_XML);
      expect(res.headers.get("content-type")).toBe("application/xml; charset=utf-8");
      expect(res.headers.get("cache-control")).toBe(
        "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      );
      expect(res.headers.get("cache-control")).not.toBe("private, no-store");
      expect(res.headers.get("X-Robots-Tag")).toBeNull();
    });
  });
});
