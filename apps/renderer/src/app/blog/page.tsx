import type { Metadata } from "next";
import Link from "next/link";
import { migrate } from "@ob-cms/block-schema";
import { RenderLayout, blockRegistry, OBSiteRootBreakpointSources } from "@ob-cms/blocks";

import { resolveHost } from "@/lib/host";
import { getSite, getNavigation } from "@/lib/site-data";
import { getPosts } from "@/lib/post-data";
import { themeTokensToCssVars } from "@/lib/theme";
import { SiteHeader, SiteFooter } from "@/components/site-navigation";
import { finalizePublicMetadata } from "@/lib/indexing-policy";

export const revalidate = 60;
export const dynamicParams = true;

export async function generateMetadata(): Promise<Metadata> {
  const host = await resolveHost();
  const site = await getSite(host);
  if (!site) return { title: "Not found" };
  const metadata: Metadata = {
    title: `Blog — ${site.name}`,
    description: `Latest posts from ${site.name}.`,
  };
  return finalizePublicMetadata(metadata, {
    feedAutodiscovery: { siteName: site.name },
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

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
}) {
  const { term } = await searchParams;
  const host = await resolveHost();
  const site = await getSite(host);
  // Unknown host → render an empty-ish shell rather than a hard 404 for the index.
  if (!site) {
    return <main className="mx-auto max-w-3xl p-8">No site found.</main>;
  }

  const [posts, nav] = await Promise.all([
    getPosts(host, term),
    getNavigation(host, site.siteId),
  ]);
  const themeStyle = themeTokensToCssVars(site.theme?.tokens);
  const headerLayout = site.chrome?.header ? migrate(site.chrome.header) : null;
  const footerLayout = site.chrome?.footer ? migrate(site.chrome.footer) : null;

  return (
    <div data-ob-site={site.siteId} style={themeStyle}>
      {headerLayout && (
        <RenderLayout
          data={headerLayout}
          blocks={blockRegistry}
          breakpointSource={OBSiteRootBreakpointSources.container}
        />
      )}
      <SiteHeader items={nav.header} />
      <main className="mx-auto max-w-3xl px-4 py-12">
          <h1 className="mb-8 text-3xl font-bold">Blog</h1>
          {posts.length === 0 ? (
            <p className="text-muted-foreground">No posts published yet.</p>
          ) : (
            <ul className="flex flex-col gap-8">
              {posts.map((post) => (
                <li key={post.id} className="border-b border-border pb-8 last:border-0">
                  <Link href={`/blog/${post.slug}`} className="group block">
                    {post.coverUrl ? (
                      <img
                        src={post.coverUrl}
                        alt={post.title}
                        className="mb-4 aspect-[16/9] w-full rounded-lg object-cover"
                      />
                    ) : null}
                    <h2 className="text-xl font-semibold group-hover:underline">{post.title}</h2>
                    {post.publishedAt ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDate(post.publishedAt)}
                      </p>
                    ) : null}
                    {post.excerpt ? (
                      <p className="mt-2 text-muted-foreground">{post.excerpt}</p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </main>
      <SiteFooter items={nav.footer} />
      {footerLayout && (
        <RenderLayout
          data={footerLayout}
          blocks={blockRegistry}
          breakpointSource={OBSiteRootBreakpointSources.container}
        />
      )}
    </div>
  );
}
