import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { migrate } from "@ob-cms/block-schema";
import { RenderLayout, blockRegistry, OBSiteRootBreakpointSources } from "@ob-cms/blocks";

import { resolveHost } from "@/lib/host";
import { getSite, getNavigation } from "@/lib/site-data";
import { getPreview } from "@/lib/preview-data";
import { themeTokensToCssVars } from "@/lib/theme";
import { PublishedPageFrame } from "@/components/published-page-frame";
import { SiteHeader, SiteFooter } from "@/components/site-navigation";
import { hasBlockGlobalChrome } from "@/lib/compose-published-page-layout";
import { LiveFormProvider } from "@/components/form-provider";

/**
 * CONTENT-OPS — token-gated DRAFT preview (no login).
 *
 * URL: `/__preview/page/<id>?token=…` and `/__preview/post/<id>?token=…`. The
 * folder is `%5F%5Fpreview` because Next treats a leading underscore as a PRIVATE
 * folder (excluded from routing); the `%5F` escape opts the literal `__preview`
 * segment back into the router while keeping the minted URL exactly as the API
 * issues it.
 *
 * The token is a capability minted by the admin
 * (`POST /{pages,posts}/:id/preview-link`). Renders the DRAFT layout (unpublished
 * edits) with a clear "PREVIEW — not published" banner. A wrong/missing/revoked
 * token → 404 (never exposes a draft). Never indexed, never cached.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Draft preview",
};

type RouteParams = { type: string; id: string };
type SearchParams = { token?: string };

function normalizeType(type: string): "page" | "post" | null {
  if (type === "page" || type === "post") return type;
  return null;
}

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<SearchParams>;
}) {
  const { type, id } = await params;
  const { token } = await searchParams;
  const kind = normalizeType(type);
  if (!kind || !token) notFound();

  const host = await resolveHost();
  const site = await getSite(host);
  if (!site) notFound();

  const content = await getPreview(host, kind, id, token);
  if (!content) notFound();

  const nav = await getNavigation(host, site.siteId);
  const themeStyle = themeTokensToCssVars(site.theme?.tokens);
  const headerLayout = site.chrome?.header ? migrate(site.chrome.header) : null;
  const footerLayout = site.chrome?.footer ? migrate(site.chrome.footer) : null;
  const blockChrome = hasBlockGlobalChrome(headerLayout, footerLayout);

  return (
    <div data-ob-site={site.siteId} data-ob-preview="true" style={themeStyle}>
      {/* PREVIEW banner — fixed, unmistakable, never in the published render. */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 2147483647,
          background: "#b45309",
          color: "#fff",
          font: "600 13px/1.4 system-ui, sans-serif",
          padding: "8px 16px",
          textAlign: "center",
          letterSpacing: "0.02em",
        }}
      >
        🔒 PREVIEW — this {kind} is NOT published. Anyone with this link can view the current draft.
      </div>

      <LiveFormProvider consentEnabled={false} policyVersion="preview">
        {kind === "post" ? (
          <>
            {!blockChrome && <SiteHeader items={nav.header} />}
            <main className="mx-auto max-w-3xl px-4 py-12">
              <article>
                <header className="mb-8">
                  <h1 className="text-4xl font-bold leading-tight">{content.title}</h1>
                  {content.coverUrl ? (
                    <img
                      src={content.coverUrl}
                      alt={content.title}
                      className="mt-6 aspect-[16/9] w-full rounded-lg object-cover"
                    />
                  ) : null}
                </header>
                <RenderLayout
                  data={content.layout}
                  blocks={blockRegistry}
                  breakpointSource={OBSiteRootBreakpointSources.container}
                />
              </article>
            </main>
            {!blockChrome && <SiteFooter items={nav.footer} />}
          </>
        ) : (
          <PublishedPageFrame
            pageLayout={content.layout}
            headerLayout={headerLayout}
            footerLayout={footerLayout}
            headerNav={nav.header}
            footerNav={nav.footer}
            env={{ locale: content.locale ?? site.defaultLocale ?? "en" }}
          />
        )}
      </LiveFormProvider>
    </div>
  );
}
