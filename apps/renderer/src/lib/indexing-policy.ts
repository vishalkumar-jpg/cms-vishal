import type { Metadata } from "next";

/** HTTP header applied to UAT/staging website responses (defense in depth). */
export const STAGING_X_ROBOTS_TAG = "noindex, nofollow, noarchive";

/** Next.js metadata robots directive for UAT/staging deployments. */
export const STAGING_ROBOTS_METADATA: NonNullable<Metadata["robots"]> = {
  index: false,
  follow: false,
  noarchive: true,
};

/**
 * Reads the deployment environment label at request/runtime (dynamic property
 * access so Next.js does not bake ENVIRONMENT into the production build artifact).
 * UAT uses `ENVIRONMENT=staging` per repo convention — do not introduce `uat`.
 */
export function deploymentEnvironment(): string {
  const value = process.env["ENVIRONMENT"];
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return "local";
}

/** True when this renderer instance serves UAT/staging websites. */
export function isStagingDeployment(): boolean {
  return deploymentEnvironment() === "staging";
}

/**
 * robots.txt body for UAT/staging: block all crawlers and do NOT reference a
 * sitemap (UAT must never expose an indexable sitemap).
 */
export function stagingRobotsTxt(): string {
  return "User-agent: *\nDisallow: /\n";
}

/** Options for RSS/Atom `<link rel="alternate">` autodiscovery on blog surfaces. */
export type FeedAutodiscoveryOptions = {
  siteName: string;
  /** Included in alternates on production only. */
  canonical?: string;
};

/** Remove search-engine-facing alternates on UAT/staging; keep language hreflang links. */
function stripStagingSearchAlternates(
  alternates: Metadata["alternates"] | undefined,
): Metadata["alternates"] | undefined {
  if (!alternates) return undefined;
  const { canonical: _canonical, types: _types, ...rest } = alternates;
  return Object.keys(rest).length > 0 ? rest : undefined;
}

export type FinalizePublicMetadataOptions = {
  feedAutodiscovery?: FeedAutodiscoveryOptions;
};

/**
 * Finalize public page metadata: apply feed autodiscovery (production only) and
 * enforce UAT/staging robots directives last so child `robots` cannot override
 * the root layout baseline.
 */
export function finalizePublicMetadata(
  metadata: Metadata,
  options?: FinalizePublicMetadataOptions,
): Metadata {
  let result = metadata;

  const feedAutodiscovery = options?.feedAutodiscovery;
  if (feedAutodiscovery) {
    const { siteName, canonical } = feedAutodiscovery;
    if (!isStagingDeployment()) {
      result = {
        ...result,
        alternates: {
          ...result.alternates,
          ...(canonical ? { canonical } : {}),
          types: {
            "application/rss+xml": [{ url: "/blog/rss.xml", title: `Blog — ${siteName}` }],
            "application/atom+xml": [{ url: "/feed.atom", title: `Blog — ${siteName}` }],
          },
        },
      };
    }
  }

  if (!isStagingDeployment()) return result;
  return {
    ...result,
    alternates: stripStagingSearchAlternates(result.alternates),
    robots: STAGING_ROBOTS_METADATA,
  };
}

/** Apply UAT/staging robots metadata, overriding any page-level indexing flags. */
export function applyStagingRobotsMetadata(metadata: Metadata): Metadata {
  return finalizePublicMetadata(metadata);
}

/** Root layout metadata helper — undefined in non-staging environments. */
export function stagingRobotsMetadataOrUndefined(): Metadata["robots"] | undefined {
  return isStagingDeployment() ? STAGING_ROBOTS_METADATA : undefined;
}

/** Whether JSON-LD structured data should be suppressed for this deployment. */
export function suppressStructuredDataForDeployment(): boolean {
  return isStagingDeployment();
}
