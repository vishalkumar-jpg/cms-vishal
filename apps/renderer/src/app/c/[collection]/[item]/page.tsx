import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { migrate, sanitizeHtml, sanitizeText, sanitizeUrl, validateBlockProps, type SerializedLayout } from "@ob-cms/block-schema";
import { RenderLayout, blockRegistry, OBSiteRootBreakpointSources } from "@ob-cms/blocks";

import { resolveHost } from "@/lib/host";
import { getSite } from "@/lib/site-data";
import { publicGet, publicApiPath } from "@/lib/api-client";
import { ConsentManager } from "@/components/consent-manager";
import { LiveFormProvider } from "@/components/form-provider";
import { finalizePublicMetadata } from "@/lib/indexing-policy";
import type {
  PublicCollectionField,
  PublicCollectionItemDetail,
  PublicConsentConfig,
} from "@/lib/public-api-types";

/**
 * Dynamic item DETAIL pages for dynamic collections (HubDB / WP-CPT detail).
 * URL shape: `/c/<collectionSlug>/<itemSlug>`. We resolve the tenant by host,
 * fetch ONE published item from the host-resolved public API, and render either
 * the collection's shared `detailLayout` (when set) or a simple field-driven
 * template (MVP fallback).
 *
 * SSR-safe: a Server Component; no client context needed. 404 when missing.
 */

export const revalidate = 60;
export const dynamicParams = true;

type RouteParams = { collection: string; item: string };

/** Matches legacy inline layout: max 48rem, centered, 3rem × 1.25rem padding. */
const COLLECTION_DETAIL_MAIN = "mx-auto max-w-3xl px-5 py-12";

async function fetchItem(
  host: string,
  collection: string,
  item: string,
): Promise<PublicCollectionItemDetail | null> {
  return publicGet<PublicCollectionItemDetail>(
    publicApiPath(
      `/collections/${encodeURIComponent(collection)}/items/${encodeURIComponent(item)}`,
    ),
    { host, revalidate: 60 },
  );
}

/** Best-effort title for an item: a `title`/`name` field, else the slug. */
function itemTitle(detail: PublicCollectionItemDetail): string {
  const data = detail.item.data;
  const titleField = detail.collection.fields.find(
    (f) => f.key === "title" || f.key === "name",
  );
  const v = titleField ? data[titleField.key] : undefined;
  if (typeof v === "string" && v.length > 0) return v;
  return detail.item.slug;
}

/** True when a migrated layout has a renderable root node. */
function isRenderableLayout(layout: SerializedLayout | null | undefined): layout is SerializedLayout {
  return Boolean(layout?.nodes && layout.root && layout.nodes[layout.root]);
}

/** True when every retained node passes block-schema prop validation. */
function layoutHasValidBlockProps(layout: SerializedLayout): boolean {
  for (const node of Object.values(layout.nodes)) {
    const type = node?.type?.resolvedName;
    if (!type) return false;
    const result = validateBlockProps(type, node.props ?? {});
    if (!result.ok) return false;
  }
  return true;
}

/** Migrate on read; returns null when migration fails or the layout is unusable. */
function migrateDetailLayout(raw: unknown): SerializedLayout | null {
  try {
    const layout = migrate(raw);
    if (!isRenderableLayout(layout)) return null;
    if (!layoutHasValidBlockProps(layout)) return null;
    return layout;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { collection, item } = await params;
  const host = await resolveHost();
  const site = await getSite(host);
  if (!site) return { title: "Not found" };

  const detail = await fetchItem(host, collection, item);
  if (!detail) return { title: site.name };

  const title = itemTitle(detail);
  const descField = detail.collection.fields.find(
    (f) => f.key === "excerpt" || f.key === "description" || f.key === "summary",
  );
  const description =
    descField && typeof detail.item.data[descField.key] === "string"
      ? (detail.item.data[descField.key] as string)
      : undefined;
  const imageField = detail.collection.fields.find((f) => f.type === "image");
  const ogImage =
    imageField && typeof detail.item.data[imageField.key] === "string"
      ? sanitizeUrl(detail.item.data[imageField.key] as string)
      : undefined;

  return finalizePublicMetadata({
    title: `${title} — ${site.name}`,
    description,
    openGraph: {
      title,
      description,
      images: ogImage ? [{ url: ogImage }] : undefined,
      siteName: site.name,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  });
}

export default async function CollectionItemPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { collection, item } = await params;
  const host = await resolveHost();

  const site = await getSite(host);
  if (!site) notFound();

  const detail = await fetchItem(host, collection, item);
  if (!detail) notFound();

  const consent = site.consent ?? null;
  const consentEnabled = consent?.enabled === true;
  const policyVersion = consent?.policyVersion ?? "1";
  const locale = site.defaultLocale ?? "en";

  const rawDetailLayout = detail.collection.detailLayout;
  if (rawDetailLayout) {
    const layout = migrateDetailLayout(rawDetailLayout);
    if (layout) {
      return (
        <main className={COLLECTION_DETAIL_MAIN}>
          <LiveFormProvider consentEnabled={consentEnabled} policyVersion={policyVersion}>
            <RenderLayout
              data={layout}
              blocks={blockRegistry}
              breakpointSource={OBSiteRootBreakpointSources.container}
              item={detail.item.data}
              env={{ locale }}
            />
          </LiveFormProvider>
          {consent && <ConsentManager config={consent} />}
        </main>
      );
    }
  }

  return (
    <GenericCollectionItemView detail={detail} consent={consent} />
  );
}

function GenericCollectionItemView({
  detail,
  consent,
}: {
  detail: PublicCollectionItemDetail;
  consent: PublicConsentConfig | null | undefined;
}) {
  const { fields } = detail.collection;
  const data = detail.item.data;
  const title = itemTitle(detail);

  return (
    <main className={COLLECTION_DETAIL_MAIN}>
      <p style={{ fontSize: "0.8125rem", color: "#64748b", marginBottom: "0.5rem" }}>
        {sanitizeText(detail.collection.name)}
      </p>
      <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "#0f172a", margin: "0 0 1.5rem" }}>
        {sanitizeText(title)}
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {fields.map((field) => {
          const value = data[field.key];
          if (value === undefined || value === null || value === "") return null;

          // Skip the field we already used as the page title.
          if ((field.key === "title" || field.key === "name") && sanitizeText(String(value)) === title) {
            return null;
          }

          return (
            <section key={field.key}>
              <h2
                style={{
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#94a3b8",
                  margin: "0 0 0.375rem",
                }}
              >
                {sanitizeText(field.label)}
              </h2>
              <FieldValue type={field.type} value={value} alt={title} />
            </section>
          );
        })}
      </div>
      {consent && <ConsentManager config={consent} />}
    </main>
  );
}

function FieldValue({
  type,
  value,
  alt,
}: {
  type: PublicCollectionField["type"];
  value: unknown;
  alt: string;
}) {
  if (type === "image") {
    const url = sanitizeUrl(String(value));
    if (!url || url === "#") return null;
    return (
      <img
        src={url}
        alt={sanitizeText(alt)}
        style={{ maxWidth: "100%", borderRadius: "0.75rem" }}
      />
    );
  }
  if (type === "richtext") {
    return (
      <div
        style={{ color: "#334155", lineHeight: 1.7 }}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(String(value)) }}
      />
    );
  }
  if (type === "boolean") {
    return <p style={{ color: "#334155", margin: 0 }}>{value ? "Yes" : "No"}</p>;
  }
  if (type === "reference") {
    const url = sanitizeUrl(String(value));
    if (url && url !== "#") {
      return (
        <a href={url} style={{ color: "#2563eb" }}>
          {sanitizeText(String(value))}
        </a>
      );
    }
  }
  return <p style={{ color: "#334155", margin: 0, lineHeight: 1.7 }}>{sanitizeText(String(value))}</p>;
}
