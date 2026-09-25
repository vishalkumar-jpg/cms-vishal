import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { Metadata } from "next";
import {
  applyStagingRobotsMetadata,
  deploymentEnvironment,
  finalizePublicMetadata,
  isStagingDeployment,
  stagingRobotsMetadataOrUndefined,
  stagingRobotsTxt,
  STAGING_ROBOTS_METADATA,
  STAGING_X_ROBOTS_TAG,
  suppressStructuredDataForDeployment,
} from "./indexing-policy";

const STAGING_ROBOTS_DIRECTIVES = {
  index: false,
  follow: false,
  noarchive: true,
} as const;

const ORIGINAL_ENVIRONMENT = process.env.ENVIRONMENT;

afterEach(() => {
  if (ORIGINAL_ENVIRONMENT === undefined) {
    delete process.env.ENVIRONMENT;
  } else {
    process.env.ENVIRONMENT = ORIGINAL_ENVIRONMENT;
  }
});

describe("indexing-policy", () => {
  describe("deploymentEnvironment", () => {
    it("defaults to local when ENVIRONMENT is unset", () => {
      delete process.env.ENVIRONMENT;
      expect(deploymentEnvironment()).toBe("local");
    });

    it("reads ENVIRONMENT=staging for UAT", () => {
      process.env.ENVIRONMENT = "staging";
      expect(deploymentEnvironment()).toBe("staging");
    });
  });

  describe("isStagingDeployment", () => {
    it("is true only for ENVIRONMENT=staging", () => {
      process.env.ENVIRONMENT = "staging";
      expect(isStagingDeployment()).toBe(true);

      process.env.ENVIRONMENT = "production";
      expect(isStagingDeployment()).toBe(false);

      process.env.ENVIRONMENT = "local";
      expect(isStagingDeployment()).toBe(false);
    });
  });

  describe("UAT/staging crawl protection", () => {
    beforeEach(() => {
      process.env.ENVIRONMENT = "staging";
    });

    it("exports noindex, nofollow, noarchive robots metadata", () => {
      expect(STAGING_ROBOTS_METADATA).toEqual({
        index: false,
        follow: false,
        noarchive: true,
      });
    });

    it("exports matching X-Robots-Tag", () => {
      expect(STAGING_X_ROBOTS_TAG).toBe("noindex, nofollow, noarchive");
    });

    it("generates block-all robots.txt without a sitemap line", () => {
      const body = stagingRobotsTxt();
      expect(body).toContain("Disallow: /");
      expect(body.toLowerCase()).not.toContain("sitemap");
    });

    it("forces staging robots metadata onto page metadata", () => {
      const input: Metadata = {
        title: "Pricing",
        robots: { index: true, follow: true },
      };
      const output = applyStagingRobotsMetadata(input);
      expect(output.robots).toEqual(STAGING_ROBOTS_METADATA);
    });

    it("finalizePublicMetadata overrides child robots that would replace root layout", () => {
      const input: Metadata = {
        title: "Editor noindex page",
        robots: { index: false, follow: false },
      };
      const output = finalizePublicMetadata(input);
      expect(output.robots).toEqual(STAGING_ROBOTS_DIRECTIVES);
      expect(output.robots).toEqual(STAGING_ROBOTS_METADATA);
    });

    it("omits feed autodiscovery on staging", () => {
      const output = finalizePublicMetadata(
        { title: "Blog — Example" },
        { feedAutodiscovery: { siteName: "Example" } },
      );
      expect(output.alternates).toBeUndefined();
      expect(output.robots).toEqual(STAGING_ROBOTS_METADATA);
    });

    it("adds feed autodiscovery on production", () => {
      process.env.ENVIRONMENT = "production";
      const output = finalizePublicMetadata(
        { title: "Blog — Example" },
        { feedAutodiscovery: { siteName: "Example", canonical: "https://example.com/blog" } },
      );
      expect(output.alternates).toEqual({
        canonical: "https://example.com/blog",
        types: {
          "application/rss+xml": [{ url: "/blog/rss.xml", title: "Blog — Example" }],
          "application/atom+xml": [{ url: "/feed.atom", title: "Blog — Example" }],
        },
      });
      expect(output.robots).toBeUndefined();
    });

    it("preserves existing language alternates when adding feed autodiscovery on production", () => {
      process.env.ENVIRONMENT = "production";
      const output = finalizePublicMetadata(
        {
          title: "Blog — Example",
          alternates: {
            languages: { "en-US": "https://example.com/blog", "es-ES": "https://example.com/es/blog" },
          },
        },
        { feedAutodiscovery: { siteName: "Example", canonical: "https://example.com/blog" } },
      );
      expect(output.alternates?.languages).toEqual({
        "en-US": "https://example.com/blog",
        "es-ES": "https://example.com/es/blog",
      });
      expect(output.alternates?.canonical).toBe("https://example.com/blog");
      expect(output.alternates?.types).toEqual({
        "application/rss+xml": [{ url: "/blog/rss.xml", title: "Blog — Example" }],
        "application/atom+xml": [{ url: "/feed.atom", title: "Blog — Example" }],
      });
      expect(output.robots).toBeUndefined();
    });

    it("removes staging canonical and feed autodiscovery", () => {
      const output = finalizePublicMetadata(
        { title: "Post" },
        { feedAutodiscovery: { siteName: "Example", canonical: "https://example.com/post" } },
      );
      expect(output.alternates?.canonical).toBeUndefined();
      expect(output.alternates?.types).toBeUndefined();
      expect(output.alternates).toBeUndefined();
      expect(output.robots).toEqual(STAGING_ROBOTS_METADATA);
    });

    it("removes existing staging canonical from incoming metadata", () => {
      const output = finalizePublicMetadata({
        title: "Page",
        alternates: {
          canonical: "https://example.com/page",
          languages: { "en-US": "https://example.com/page" },
        },
      });
      expect(output.alternates?.canonical).toBeUndefined();
      expect(output.alternates?.types).toBeUndefined();
      expect(output.alternates?.languages).toEqual({ "en-US": "https://example.com/page" });
      expect(output.robots).toEqual(STAGING_ROBOTS_METADATA);
    });

    it("sets alternates to undefined when only canonical and types were present", () => {
      const output = finalizePublicMetadata({
        title: "Page",
        alternates: {
          canonical: "https://example.com/page",
          types: {
            "application/rss+xml": [{ url: "/blog/rss.xml", title: "Blog" }],
          },
        },
      });
      expect(output.alternates).toBeUndefined();
      expect(output.robots).toEqual(STAGING_ROBOTS_METADATA);
    });

    it("returns staging robots for root layout metadata", () => {
      expect(stagingRobotsMetadataOrUndefined()).toEqual(STAGING_ROBOTS_METADATA);
    });

    it("suppresses structured data on staging even when page is indexable", () => {
      expect(suppressStructuredDataForDeployment()).toBe(true);
    });
  });

  describe("production/local behavior", () => {
    it("does not alter metadata when not staging", () => {
      process.env.ENVIRONMENT = "production";
      const input: Metadata = {
        title: "Home",
        robots: { index: true, follow: true },
      };
      expect(applyStagingRobotsMetadata(input)).toEqual(input);
      expect(stagingRobotsMetadataOrUndefined()).toBeUndefined();
    });

    it("does not suppress structured data on production", () => {
      process.env.ENVIRONMENT = "production";
      expect(suppressStructuredDataForDeployment()).toBe(false);
    });
  });
});
