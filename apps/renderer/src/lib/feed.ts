import type { PublicSite, PublicPostCard } from "./public-api-types";
import { absoluteUrl } from "./structured-data";

/**
 * RSS 2.0 / Atom 1.0 feed builders for the public blog. Pure functions: they
 * take already-fetched site + published-post data (from getSite/getPosts) plus
 * the request-resolved absolute origin, and return a well-formed XML string.
 *
 * Everything is host-resolved by the caller — all links are absolute to the
 * requesting tenant's domain. Only published posts are ever passed in (the API
 * `/api/v1/public/posts` index returns published posts only; no drafts/secrets).
 */

/** Escape the five XML predefined entities for use in text nodes/attributes. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Wrap HTML/rich text in a CDATA section so markup passes through un-escaped.
 * `]]>` is the only sequence that can terminate CDATA early, so split it.
 */
export function cdata(value: string): string {
  return `<![CDATA[${value.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

/** RFC-822 date (required by RSS 2.0), e.g. "Wed, 02 Oct 2002 13:00:00 GMT". */
export function toRfc822(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const date = Number.isNaN(d.getTime()) ? new Date() : d;
  return date.toUTCString();
}

/** RFC-3339 date (required by Atom), e.g. "2002-10-02T13:00:00.000Z". */
export function toRfc3339(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const date = Number.isNaN(d.getTime()) ? new Date() : d;
  return date.toISOString();
}

/** The most recent publishedAt across posts, or now for an empty feed. */
function latestPublishedAt(posts: PublicPostCard[]): string | null {
  let latest: number | null = null;
  for (const p of posts) {
    if (!p.publishedAt) continue;
    const t = new Date(p.publishedAt).getTime();
    if (!Number.isNaN(t) && (latest === null || t > latest)) latest = t;
  }
  return latest === null ? null : new Date(latest).toISOString();
}

export interface FeedContext {
  site: PublicSite;
  posts: PublicPostCard[];
  /** Absolute origin for the resolved host, e.g. "https://acme.com". */
  origin: string;
}

/** Build a valid RSS 2.0 document. Empty posts → a valid empty channel. */
export function buildRssFeed({ site, posts, origin }: FeedContext): string {
  const siteName = site.name;
  const blogUrl = absoluteUrl(origin, "/blog");
  const feedUrl = absoluteUrl(origin, "/blog/rss.xml");
  const language = site.defaultLocale || "en";
  const description = `Latest posts from ${siteName}.`;

  const items = posts
    .map((post) => {
      const link = absoluteUrl(origin, `/blog/${post.slug}`);
      const parts: string[] = [
        `<title>${escapeXml(post.title)}</title>`,
        `<link>${escapeXml(link)}</link>`,
        `<guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `<pubDate>${toRfc822(post.publishedAt)}</pubDate>`,
      ];
      if (post.excerpt) {
        parts.push(`<description>${cdata(post.excerpt)}</description>`);
      }
      return `    <item>\n      ${parts.join("\n      ")}\n    </item>`;
    })
    .join("\n");

  const channelBits: string[] = [
    `<title>${escapeXml(`Blog — ${siteName}`)}</title>`,
    `<link>${escapeXml(blogUrl)}</link>`,
    `<description>${escapeXml(description)}</description>`,
    `<language>${escapeXml(language)}</language>`,
    `<lastBuildDate>${toRfc822(latestPublishedAt(posts))}</lastBuildDate>`,
    `<generator>OB-CMS</generator>`,
    `<atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
  ];

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
    `  <channel>\n    ${channelBits.join("\n    ")}\n` +
    (items ? `${items}\n` : "") +
    `  </channel>\n` +
    `</rss>\n`
  );
}

/** Build a valid Atom 1.0 document. Empty posts → a valid empty feed. */
export function buildAtomFeed({ site, posts, origin }: FeedContext): string {
  const siteName = site.name;
  const blogUrl = absoluteUrl(origin, "/blog");
  const feedUrl = absoluteUrl(origin, "/feed.atom");
  const updated = toRfc3339(latestPublishedAt(posts));

  const entries = posts
    .map((post) => {
      const link = absoluteUrl(origin, `/blog/${post.slug}`);
      const parts: string[] = [
        `<title>${escapeXml(post.title)}</title>`,
        `<link href="${escapeXml(link)}" />`,
        `<id>${escapeXml(link)}</id>`,
        `<updated>${toRfc3339(post.publishedAt)}</updated>`,
        `<published>${toRfc3339(post.publishedAt)}</published>`,
      ];
      if (post.excerpt) {
        parts.push(`<summary type="html">${cdata(post.excerpt)}</summary>`);
      }
      return `  <entry>\n    ${parts.join("\n    ")}\n  </entry>`;
    })
    .join("\n");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<feed xmlns="http://www.w3.org/2005/Atom">\n` +
    `  <title>${escapeXml(`Blog — ${siteName}`)}</title>\n` +
    `  <subtitle>${escapeXml(`Latest posts from ${siteName}.`)}</subtitle>\n` +
    `  <link href="${escapeXml(feedUrl)}" rel="self" type="application/atom+xml" />\n` +
    `  <link href="${escapeXml(blogUrl)}" rel="alternate" type="text/html" />\n` +
    `  <id>${escapeXml(feedUrl)}</id>\n` +
    `  <updated>${updated}</updated>\n` +
    (entries ? `${entries}\n` : "") +
    `</feed>\n`
  );
}
