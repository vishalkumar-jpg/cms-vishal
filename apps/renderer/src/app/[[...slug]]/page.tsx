import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { migrate } from "@ob-cms/block-schema";

import { resolveHost } from "@/lib/host";
import { resolveVisitorAudiences } from "@/lib/personalize";
import { getSite, getNavigation } from "@/lib/site-data";
import { getPage } from "@/lib/page-data";
import { resolveLocaleFromSlug, alternateUrl } from "@/lib/locale";
import { themeTokensToCssVars } from "@/lib/theme";
import { PublishedPageFrame } from "@/components/published-page-frame";
import { JsonLd } from "@/components/json-ld";
import {
  SiteIntegrationScripts,
  BodyIntegrationScripts,
} from "@/components/site-integrations";
import {
  organizationLd,
  webSiteLd,
  breadcrumbLd,
  originForHost,
} from "@/lib/structured-data";
import { LiveFormProvider } from "@/components/form-provider";
import { ScrollFX } from "@/components/scroll-fx";
import { Analytics } from "@/components/analytics";
import { ExperimentGoals } from "@/components/experiment-goals";
import { ConsentManager } from "@/components/consent-manager";
import {
  finalizePublicMetadata,
} from "@/lib/indexing-policy";

/**
 * Public catch-all route (Server Component) — TECH-ARCHITECTURE §2.4 render
 * pipeline. Resolves host → site, fetches the published page, migrates the
 * layout to the current schema, and renders the SHARED block registry (the same
 * components the builder uses → editor/renderer parity). Theme tokens are
 * injected as CSS variables on a wrapper so blocks are themed per tenant.
 *
 * Caching: ISR via `revalidate` below + a Redis page cache (see lib/page-data).
 */

// ISR: statically render + revalidate. On-demand purge via /api/revalidate.
export const revalidate = 60;
export const dynamicParams = true;

type RouteParams = { slug?: string[] };

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const host = await resolveHost();
  const site = await getSite(host);
  if (!site) return { title: "Not found" };

  // i18n (B13): peel a leading locale segment (non-default locales only).
  const { locale, path } = resolveLocaleFromSlug(slug, site);
  const page = await getPage(host, site.siteId, path, locale);
  if (!page) return { title: site.name };

  const { seo } = page;
  const metadata: Metadata = {
    title: seo.title || site.name,
    description: seo.description || undefined,
  };

  // i18n: hreflang alternates for every available translation + x-default
  // (pointing at the default-locale URL). Emitted via metadata.alternates so
  // Next renders <link rel="alternate" hreflang="..."> in <head>.
  const origin = originForHost(host);
  const languages: Record<string, string> = {};
  let xDefault: string | undefined;
  const defaultLocale = page.defaultLocale ?? site.defaultLocale ?? "en";
  for (const alt of page.alternates ?? []) {
    const url = alternateUrl(origin, alt.path);
    languages[alt.locale] = url;
    if (alt.locale === defaultLocale) xDefault = url;
  }
  metadata.alternates = {
    canonical: seo.canonical || undefined,
    ...(Object.keys(languages).length > 0
      ? { languages: { ...languages, ...(xDefault ? { "x-default": xDefault } : {}) } }
      : {}),
  };

  metadata.openGraph = {
    title: seo.title || site.name,
    description: seo.description || undefined,
    images: seo.ogImage ? [{ url: seo.ogImage }] : undefined,
    url: seo.canonical || undefined,
    siteName: site.name,
    // i18n: og:locale reflects the served locale (BCP-47 underscore form).
    locale: (page.locale ?? locale).replace("-", "_"),
  };
  metadata.twitter = {
    card: "summary_large_image",
    title: seo.title || site.name,
    description: seo.description || undefined,
    images: seo.ogImage ? [seo.ogImage] : undefined,
  };

  // `noindex` may arrive on seo via the API (extend PageSeo as needed).
  const noindex = (seo as unknown as { noindex?: boolean }).noindex === true;
  if (noindex) metadata.robots = { index: false, follow: false };

  return finalizePublicMetadata(metadata);
}

export default async function CatchAllPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  const host = await resolveHost();

  // 1. Tenant by host. Unknown host → 404.
  const site = await getSite(host);
  if (!site) notFound();

  // i18n (B13): resolve the active locale from a leading path segment (only
  // non-default locales carry a prefix; default-locale URLs are unchanged).
  const { locale, path } = resolveLocaleFromSlug(slug, site);

  // 2. Published page for (path, locale), migrated to current schema. The API
  // falls back to the default locale when a translation is missing. No page → 404.
  const page = await getPage(host, site.siteId, path, locale);
  if (!page) notFound();

  // 3. Navigation (header/footer) for this site.
  const nav = await getNavigation(host, site.siteId);

  // ── Phase 4 personalization ───────────────────────────────────────────────
  // Resolve the current visitor's audience membership set (from the first-party
  // `ob_vid` cookie the tracker mirrors) so node-level `visibleIf: audience`
  // conditions evaluate server-side. Absent cookie → empty set (an `in` fails, a
  // `not-in` passes); the walker still runs pure + SSR-safe. Reading the cookie
  // opts this render into per-request dynamic rendering (personalized output is
  // not shared-cached), which is correct for targeted content.
  const { visitorId, audiences } = await resolveVisitorAudiences(host);
  const layout = page.layout;

  // 4. Theme tokens → CSS variables on the wrapper so blocks are themed.
  const themeStyle = themeTokensToCssVars(site.theme?.tokens);

  // SEO structured data (gap D22): site-wide Organization + WebSite, plus a
  // BreadcrumbList derived from the request path. Rendered as JSON-LD in the
  // SSR HTML for crawlers/rich-results. Suppressed when the page is noindex.
  const origin = originForHost(host);
  const pageNoindex = (page.seo as unknown as { noindex?: boolean }).noindex === true;
  const structuredData = pageNoindex
    ? []
    : [organizationLd(site, origin), webSiteLd(site, origin), breadcrumbLd(path, origin)];

  // GLOBAL-CHROME — ONE global header + footer per site, applied around EVERY
  // page. Migrated on read for editor↔renderer parity. When unset (null) we
  // inject nothing, so existing pages with per-page nav/footer are unaffected.
  const headerLayout = site.chrome?.header ? migrate(site.chrome.header) : null;
  const footerLayout = site.chrome?.footer ? migrate(site.chrome.footer) : null;

  // PRIVACY & CONSENT — when the site has the banner enabled, the trackers must
  // fire ONLY after consent. `consentEnabled` flips the trackers into gated mode
  // (no ob_vid / no beacons until the visitor accepts). `policyVersion` lets a
  // bumped policy re-prompt everyone. When the banner is off, all trackers keep
  // their prior behaviour (DNT-only) — no regression.
  const consent = site.consent ?? null;
  const consentEnabled = consent?.enabled === true;
  const policyVersion = consent?.policyVersion ?? "1";

  return (
    <div data-ob-site={site.siteId} style={themeStyle}>
      <JsonLd data={structuredData} />
      {/* Site Settings hub (#32) — GA4/GTM/chat loaders + raw head scripts. Only
          emits when the site has integrations; renders nothing otherwise. */}
      <SiteIntegrationScripts integrations={site.integrations} />
      <LiveFormProvider consentEnabled={consentEnabled} policyVersion={policyVersion}>
        <PublishedPageFrame
          pageLayout={layout}
          headerLayout={headerLayout}
          footerLayout={footerLayout}
          headerNav={nav.header}
          footerNav={nav.footer}
          manageCookies={consentEnabled}
          env={{ locale, audiences, ...(visitorId ? { visitorId } : {}) }}
        />
      </LiveFormProvider>
      {/* Site Settings hub (#32) — admin-authored end-of-body scripts. */}
      <BodyIntegrationScripts integrations={site.integrations} />
      {/* Scroll / entrance interactions runtime — adds `js-ready`, observes
          reveal elements, runs parallax. SSR-safe + a no-op when there are no
          reveal/parallax blocks on the page. */}
      <ScrollFX />
      {/* First-party privacy-friendly analytics (Phase 2a). Fires a pageview
          beacon on load + observes Core Web Vitals, POSTing same-origin to the
          `/collect` proxy. Honors Do-Not-Track; no PII / no cross-site cookies. */}
      <Analytics consentEnabled={consentEnabled} policyVersion={policyVersion} />
      {/* A/B conversion tracker (Phase 4). Reads the visitor's active experiment
          assignments (written by Experiment blocks on exposure) and fires a
          `conversion` beacon when a goal (pageview/click/form_submit) is met.
          No-op when the visitor has no assignments; honors Do-Not-Track. */}
      <ExperimentGoals consentEnabled={consentEnabled} policyVersion={policyVersion} />
      {/* PRIVACY & CONSENT — the consent banner + preference-center (client-side,
          no SSR flash). Renders nothing when the site hasn't enabled consent or
          once a decision exists. Gates the trackers above via the ob_consent
          cookie (lib/consent). The footer "Manage cookies" link re-opens it. */}
      {consent ? <ConsentManager config={consent} /> : null}
    </div>
  );
}
