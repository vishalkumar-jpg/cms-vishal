import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { migrate } from "@ob-cms/block-schema";
import { RenderLayout, blockRegistry, OBSiteRootBreakpointSources } from "@ob-cms/blocks";

import { resolveHost } from "@/lib/host";
import { getSite, getNavigation } from "@/lib/site-data";
import { getPost } from "@/lib/post-data";
import { themeTokensToCssVars } from "@/lib/theme";
import { SiteHeader, SiteFooter } from "@/components/site-navigation";
import { JsonLd } from "@/components/json-ld";
import {
  organizationLd,
  webSiteLd,
  breadcrumbLd,
  articleLd,
  originForHost,
} from "@/lib/structured-data";
import { LiveFormProvider } from "@/components/form-provider";
import { ConsentManager } from "@/components/consent-manager";
import {
  finalizePublicMetadata,
} from "@/lib/indexing-policy";

export const revalidate = 60;
export const dynamicParams = true;

type RouteParams = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const host = await resolveHost();
  const site = await getSite(host);
  if (!site) return { title: "Not found" };

  const post = await getPost(host, slug);
  if (!post) return { title: site.name };

  const seo = post.seo;
  const title = seo.title || post.title || site.name;
  const description = seo.description || post.excerpt || undefined;
  const ogImage = seo.ogImage || post.coverUrl || undefined;

  const metadata: Metadata = { title, description };
  metadata.openGraph = {
    type: "article",
    title,
    description,
    images: ogImage ? [{ url: ogImage }] : undefined,
    url: seo.canonical || undefined,
    siteName: site.name,
    publishedTime: post.publishedAt || undefined,
  };
  metadata.twitter = {
    card: "summary_large_image",
    title,
    description,
    images: ogImage ? [ogImage] : undefined,
  };
  const noindex = (seo as unknown as { noindex?: boolean }).noindex === true;
  if (noindex) metadata.robots = { index: false, follow: false };
  return finalizePublicMetadata(metadata, {
    feedAutodiscovery: {
      siteName: site.name,
      ...(seo.canonical ? { canonical: seo.canonical } : {}),
    },
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  const host = await resolveHost();

  const site = await getSite(host);
  if (!site) notFound();

  const post = await getPost(host, slug);
  if (!post) notFound();

  const nav = await getNavigation(host, site.siteId);
  const themeStyle = themeTokensToCssVars(site.theme?.tokens);
  const headerLayout = site.chrome?.header ? migrate(site.chrome.header) : null;
  const footerLayout = site.chrome?.footer ? migrate(site.chrome.footer) : null;
  const categories = post.terms.filter((t) => t.kind === "category");

  // PRIVACY & CONSENT — same gating as the catch-all route (banner + form gate).
  const consent = site.consent ?? null;
  const consentEnabled = consent?.enabled === true;
  const policyVersion = consent?.policyVersion ?? "1";

  // SEO structured data (gap D22): Article for the post + site-wide Organization
  // & WebSite + a Home → Blog → Post breadcrumb. Suppressed when noindex.
  const origin = originForHost(host);
  const postNoindex = (post.seo as unknown as { noindex?: boolean }).noindex === true;
  const structuredData = postNoindex
    ? []
    : [
        articleLd(post, site, origin),
        organizationLd(site, origin),
        webSiteLd(site, origin),
        breadcrumbLd(`/blog/${post.slug}`, origin),
      ];

  return (
    <div data-ob-site={site.siteId} style={themeStyle}>
      <JsonLd data={structuredData} />
      {headerLayout && (
        <RenderLayout
          data={headerLayout}
          blocks={blockRegistry}
          breakpointSource={OBSiteRootBreakpointSources.container}
        />
      )}
      <SiteHeader items={nav.header} />
      <LiveFormProvider consentEnabled={consentEnabled} policyVersion={policyVersion}>
        <main className="mx-auto max-w-3xl px-4 py-12">
          <Link href="/blog" className="text-sm text-muted-foreground hover:underline">
            ← Back to blog
          </Link>
          <article className="mt-6">
            <header className="mb-8">
              <h1 className="text-4xl font-bold leading-tight">{post.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {post.publishedAt ? <span>{formatDate(post.publishedAt)}</span> : null}
                {categories.map((c) => (
                  <span key={c.slug} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {c.name}
                  </span>
                ))}
              </div>
              {post.coverUrl ? (
                <img
                  src={post.coverUrl}
                  alt={post.title}
                  className="mt-6 aspect-[16/9] w-full rounded-lg object-cover"
                />
              ) : null}
            </header>
            <RenderLayout
              data={post.layout}
              blocks={blockRegistry}
              breakpointSource={OBSiteRootBreakpointSources.container}
            />
          </article>
        </main>
      </LiveFormProvider>
      <SiteFooter items={nav.footer} manageCookies={consentEnabled} />
      {footerLayout && (
        <RenderLayout
          data={footerLayout}
          blocks={blockRegistry}
          breakpointSource={OBSiteRootBreakpointSources.container}
        />
      )}
      {consent ? <ConsentManager config={consent} /> : null}
    </div>
  );
}
