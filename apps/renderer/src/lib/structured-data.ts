import type { PublicSite } from "./public-api-types";
import type { RenderPost } from "./post-data";

/**
 * JSON-LD structured-data builders (schema.org) for the public renderer — gap
 * D22. Each builder returns a plain JSON object that is serialized into a
 * `<script type="application/ld+json">` tag rendered in the page body (SSR-safe;
 * no client APIs). Shapes follow https://schema.org and Google's rich-result
 * guidelines (Organization, WebSite, BreadcrumbList, Article).
 *
 * SSR-safety: builders are pure — they take already-fetched data and never read
 * `window`/`document`. The absolute origin is derived from the request host that
 * the route already resolved, so URLs are canonical per tenant.
 */

/** Build the absolute origin (https) for a resolved host. */
export function originForHost(host: string): string {
  // Local/dev hosts stay http; everything else is https (public sites are TLS).
  const isLocal = /^(localhost|127\.|0\.0\.0\.0)/.test(host) || host.endsWith(".local");
  const proto = isLocal ? "http" : "https";
  return `${proto}://${host}`;
}

/** Join an origin + path into an absolute URL (path is "/"-prefixed). */
export function absoluteUrl(origin: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path; // already absolute
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

/** schema.org Organization — site-wide, from the site name + brand logo. */
export function organizationLd(site: PublicSite, origin: string): Record<string, unknown> {
  const logo = site.theme?.brand?.logoUrl;
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.theme?.brand?.name || site.name,
    url: origin,
  };
  if (logo) ld.logo = absoluteUrl(origin, logo);
  return ld;
}

/** schema.org WebSite — site-wide, enables the site-name sitelink. */
export function webSiteLd(site: PublicSite, origin: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: origin,
  };
}

/**
 * schema.org BreadcrumbList built from a request path. `/` yields a single Home
 * crumb; `/about/team` yields Home → About → Team with absolute item URLs.
 */
export function breadcrumbLd(path: string, origin: string): Record<string, unknown> {
  const segments = path.split("/").filter(Boolean);
  const items: Array<Record<string, unknown>> = [
    { "@type": "ListItem", position: 1, name: "Home", item: origin },
  ];
  let acc = "";
  segments.forEach((seg, i) => {
    acc += `/${seg}`;
    items.push({
      "@type": "ListItem",
      position: i + 2,
      name: humanizeSegment(seg),
      item: absoluteUrl(origin, acc),
    });
  });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}

/** schema.org Article for a blog post (title/author/dates/cover/description). */
export function articleLd(
  post: RenderPost,
  site: PublicSite,
  origin: string,
): Record<string, unknown> {
  const url = absoluteUrl(origin, `/blog/${post.slug}`);
  const image = post.seo?.ogImage || post.coverUrl;
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.seo?.title || post.title,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    publisher: organizationLd(site, origin),
  };
  if (post.seo?.description || post.excerpt) {
    ld.description = post.seo?.description || post.excerpt || undefined;
  }
  if (image) ld.image = [absoluteUrl(origin, image)];
  if (post.publishedAt) {
    ld.datePublished = post.publishedAt;
    ld.dateModified = post.publishedAt;
  }
  // Author is not modeled on PublicPost yet; fall back to the org as author so
  // the Article shape stays valid for Google's rich-result check.
  ld.author = { "@type": "Organization", name: site.theme?.brand?.name || site.name };
  return ld;
}

/** Turn a slug segment into a readable crumb label ("about-us" → "About Us"). */
function humanizeSegment(seg: string): string {
  return decodeURIComponent(seg)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Render a list of JSON-LD objects as a single `<script type="application/ld+json">`
 * string payload. Each object is serialized; `<` is escaped to `<` to keep
 * the script tag from being closed by data (XSS-safe injection).
 */
export function serializeLd(objects: Array<Record<string, unknown>>): string {
  const payload = objects.length === 1 ? objects[0] : objects;
  return JSON.stringify(payload).replace(/</g, "\\u003c");
}
