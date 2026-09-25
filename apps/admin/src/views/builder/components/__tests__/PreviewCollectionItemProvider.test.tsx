import { describe, expect, it } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Heading, NodeBindingContext, useBoundProp, useRepeaterItem } from "@ob-cms/blocks";
import { PreviewCollectionItemProvider } from "../PreviewCollectionItemProvider";
import { useCollectionDetailBuilderContext } from "../../collection-detail/CollectionDetailBuilderContext";

const FIELDS = [
  { key: "title", label: "Title", type: "text" as const },
  { key: "featuredImage", label: "Featured image", type: "image" as const },
];

const DetailProbe: React.FC = () => {
  const detail = useCollectionDetailBuilderContext();
  const item = useRepeaterItem();
  return (
    <span
      data-detail-slug={detail?.collectionSlug ?? ""}
      data-field-count={detail?.fields.length ?? 0}
      data-item-title={String(item?.data.title ?? "")}
      data-item-index={item?.index ?? -1}
      data-item-count={item?.count ?? -1}
    />
  );
};

const BoundHeadingProbe: React.FC = () => {
  const text = useBoundProp("text", "Static placeholder");
  return <Heading text={text} level={2} />;
};

describe("PreviewCollectionItemProvider", () => {
  it("exposes detail context fields and sample item data at layout root", () => {
    const html = renderToStaticMarkup(
      <PreviewCollectionItemProvider
        collectionId="col_1"
        collectionSlug="articles"
        fields={FIELDS}
        previewItem={{
          id: "cit_1",
          siteId: "site_1",
          collectionId: "col_1",
          slug: "hello-world",
          data: { title: "Hello World", featuredImage: "/img.jpg" },
          status: "published",
          publishedAt: "2026-01-01T00:00:00.000Z",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }}
      >
        <DetailProbe />
      </PreviewCollectionItemProvider>,
    );

    expect(html).toContain('data-detail-slug="articles"');
    expect(html).toContain('data-field-count="2"');
    expect(html).toContain('data-item-title="Hello World"');
    expect(html).toContain('data-item-index="0"');
    expect(html).toContain('data-item-count="1"');
  });

  it("uses placeholder item data when preview item is omitted", () => {
    const html = renderToStaticMarkup(
      <PreviewCollectionItemProvider
        collectionId="col_1"
        collectionSlug="articles"
        fields={FIELDS}
      >
        <DetailProbe />
      </PreviewCollectionItemProvider>,
    );

    expect(html).toContain('data-item-title="Sample title"');
  });

  it("updates canvas binding preview when preview item changes", () => {
    const previewItem = {
      id: "cit_1",
      siteId: "site_1",
      collectionId: "col_1",
      slug: "first",
      data: { title: "First title" },
      status: "published" as const,
      publishedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const BoundWithBinding: React.FC<{ item: typeof previewItem }> = ({ item }) => (
      <PreviewCollectionItemProvider
        collectionId="col_1"
        collectionSlug="articles"
        fields={FIELDS}
        previewItem={item}
      >
        <NodeBindingContext.Provider value={{ text: "title" }}>
          <BoundHeadingProbe />
        </NodeBindingContext.Provider>
      </PreviewCollectionItemProvider>
    );

    const first = renderToStaticMarkup(<BoundWithBinding item={previewItem} />);
    const second = renderToStaticMarkup(
      <BoundWithBinding
        item={{ ...previewItem, slug: "second", data: { title: "Second title" } }}
      />,
    );

    expect(first).toContain("First title");
    expect(second).toContain("Second title");
    expect(first).not.toContain("Static placeholder");
    expect(second).not.toContain("Static placeholder");
  });
});
