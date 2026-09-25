import * as React from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutPreviewPane } from "@/views/builder/components/LayoutPreviewPane";
import { normalizePreviewLayout } from "@/views/builder/lib/normalizePreviewLayout";
import {
  CATEGORY_LABEL,
  METADATA_LABEL,
  STATUS_LABEL,
  STATUS_VARIANT,
} from "@/views/template-catalog/lib/catalogLabels";
import { useTemplateSkeletonById } from "@/views/template-catalog/hooks/useTemplateSkeleton";
import { TemplateLibraryMetadataPanel } from "./components/TemplateLibraryMetadataPanel";
import {
  formatPageTypes,
  formatPreviewDate,
  templateKeyLabel,
} from "./lib/formatLibraryMetadata";
import {
  useTemplateSkeletonHistory,
  useTemplateSkeletonHistoryVersion,
} from "./hooks/useTemplateSkeletonHistory";
import { useTemplateSkeletonUsage } from "./hooks/useTemplateSkeletonUsage";
import {
  formatStarterUsageTotal,
} from "./lib/formatTemplateUsage";
import { TEMPLATE_LIBRARY_TITLE } from "./constants";

const DETAIL_TABS = ["overview", "history", "usage"] as const;
type DetailTab = (typeof DETAIL_TABS)[number];

function parseDetailTab(value: string | null): DetailTab {
  return DETAIL_TABS.includes(value as DetailTab) ? (value as DetailTab) : "overview";
}

/** Minimal starter template detail page — overview + immutable version history. */
export const TemplateStarterDetailPage: React.FC = () => {
  const { id = "" } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseDetailTab(searchParams.get("tab"));
  const selectedVersion = searchParams.get("version");

  const { data: skeleton, isLoading, isError } = useTemplateSkeletonById(id, !!id);
  const {
    data: history = [],
    isLoading: historyLoading,
    isError: historyError,
  } = useTemplateSkeletonHistory(
    id,
    activeTab === "history" && !!id,
  );
  const { data: usage, isLoading: usageLoading } = useTemplateSkeletonUsage(
    id,
    (activeTab === "usage" || activeTab === "overview") && !!id,
  );
  const versionInHistory =
    !!selectedVersion && history.some((row) => row.version === selectedVersion);
  const { data: versionDetail, isLoading: versionLoading } = useTemplateSkeletonHistoryVersion(
    id,
    selectedVersion,
    activeTab === "history" && versionInHistory,
  );

  React.useEffect(() => {
    if (activeTab !== "history" || historyLoading || history.length === 0) return;
    if (selectedVersion && history.some((row) => row.version === selectedVersion)) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", "history");
        next.set("version", history[0]!.version);
        return next;
      },
      { replace: true },
    );
  }, [activeTab, history, historyLoading, selectedVersion, setSearchParams]);

  const previewLayout = React.useMemo(
    () => normalizePreviewLayout(versionDetail?.content.layout),
    [versionDetail?.content.layout],
  );

  const setTab = (tab: DetailTab): void => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      if (tab !== "history") next.delete("version");
      return next;
    });
  };

  const selectVersion = (version: string): void => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", "history");
      next.set("version", version);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-muted-foreground">Loading template details…</p>
      </div>
    );
  }

  if (isError || !skeleton) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Link
          to="/template-library"
          className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Back to {TEMPLATE_LIBRARY_TITLE}
        </Link>
        <p className="text-sm text-destructive">Starter template not found.</p>
      </div>
    );
  }

  const showStatus = skeleton.metadata.status !== "published";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <Link
        to="/template-library"
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Back to {TEMPLATE_LIBRARY_TITLE}
      </Link>

      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold">{skeleton.metadata.displayName}</h1>
        <p className="text-sm text-muted-foreground">{skeleton.metadata.description}</p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant="secondary">
            {CATEGORY_LABEL[skeleton.metadata.category] ?? skeleton.metadata.category}
          </Badge>
          {showStatus ? (
            <Badge variant={STATUS_VARIANT[skeleton.metadata.status]}>
              {STATUS_LABEL[skeleton.metadata.status] ?? skeleton.metadata.status}
            </Badge>
          ) : null}
          <span className="text-xs text-muted-foreground">
            Current version v{skeleton.metadata.version}
          </span>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setTab(parseDetailTab(value))}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
          <TemplateLibraryMetadataPanel
            featured={skeleton.metadata.previewMetadata?.featured}
            tags={skeleton.metadata.tags}
            hint={undefined}
            fields={[
              {
                label: METADATA_LABEL.updated,
                value: formatPreviewDate(skeleton.metadata.updatedAt),
              },
              {
                label: METADATA_LABEL.templateKey,
                value: (
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {templateKeyLabel(skeleton.metadata.templateKey)}
                  </code>
                ),
              },
              {
                label: METADATA_LABEL.version,
                value: `v${skeleton.metadata.version}`,
              },
              {
                label: METADATA_LABEL.pageTypes,
                value: formatPageTypes(skeleton.metadata.supportedPageTypes),
              },
            ]}
          />
          <section className="rounded-lg border border-border bg-muted/20 p-4">
            <h2 className="text-sm font-semibold">Usage</h2>
            {usageLoading && !usage ? (
              <p className="mt-2 text-sm text-muted-foreground">Loading usage…</p>
            ) : usage ? (
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Total uses
                  </dt>
                  <dd>{formatStarterUsageTotal(usage.totalPages)}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Last used
                  </dt>
                  <dd>
                    {usage.lastUsedAt ? formatPreviewDate(usage.lastUsedAt) : "Not used yet"}
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Current version
                  </dt>
                  <dd>v{usage.currentVersion}</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Latest version
                  </dt>
                  <dd>v{usage.latestVersion}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Usage unavailable.</p>
            )}
          </section>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="rounded-lg border border-border bg-muted/20 p-2">
              <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Versions
              </p>
              {historyLoading ? (
                <p className="px-2 py-2 text-sm text-muted-foreground">Loading history…</p>
              ) : historyError ? (
                <p className="px-2 py-2 text-sm text-destructive">Could not load version history.</p>
              ) : history.length === 0 ? (
                <p className="px-2 py-2 text-sm text-muted-foreground">No version history yet.</p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {history.map((row) => {
                    const active = row.version === selectedVersion;
                    return (
                      <li key={`${row.version}-${row.createdAt}`}>
                        <button
                          type="button"
                          className={`w-full rounded-md px-2 py-2 text-left text-sm transition-colors ${
                            active
                              ? "bg-background font-medium text-foreground shadow-sm"
                              : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                          }`}
                          aria-current={active ? "true" : undefined}
                          onClick={() => selectVersion(row.version)}
                        >
                          v{row.version}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </aside>

            <section className="min-w-0 space-y-4">
              {!selectedVersion ? (
                <p className="text-sm text-muted-foreground">Select a version to inspect.</p>
              ) : versionLoading && !versionDetail ? (
                <p className="text-sm text-muted-foreground">Loading version snapshot…</p>
              ) : versionDetail ? (
                <>
                  <div className="overflow-hidden rounded-lg border border-border">
                    <LayoutPreviewPane
                      layout={previewLayout}
                      loading={versionLoading}
                      label={`${skeleton.metadata.displayName} v${versionDetail.version} preview`}
                      className="aspect-[16/10] w-full"
                    />
                  </div>
                  <TemplateLibraryMetadataPanel
                    hint={undefined}
                    fields={[
                      {
                        label: METADATA_LABEL.version,
                        value: `v${versionDetail.version}`,
                      },
                      {
                        label: "Created",
                        value: formatPreviewDate(versionDetail.createdAt),
                      },
                      {
                        label: METADATA_LABEL.status,
                        value: (
                          <Badge variant={STATUS_VARIANT[versionDetail.metadata.status] ?? "outline"}>
                            {STATUS_LABEL[versionDetail.metadata.status] ??
                              versionDetail.metadata.status}
                          </Badge>
                        ),
                      },
                      {
                        label: METADATA_LABEL.templateKey,
                        value: (
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                            {templateKeyLabel(versionDetail.templateKey)}
                          </code>
                        ),
                      },
                    ]}
                  />
                </>
              ) : (
                <p className="text-sm text-destructive">Version snapshot not found.</p>
              )}
            </section>
          </div>
        </TabsContent>

        <TabsContent value="usage" className="mt-4 space-y-6">
          {usageLoading && !usage ? (
            <p className="text-sm text-muted-foreground">Loading usage analytics…</p>
          ) : usage ? (
            <>
              <TemplateLibraryMetadataPanel
                hint={undefined}
                fields={[
                  {
                    label: "Total uses",
                    value: formatStarterUsageTotal(usage.totalPages),
                  },
                  {
                    label: "Last used",
                    value: usage.lastUsedAt
                      ? formatPreviewDate(usage.lastUsedAt)
                      : "Not used yet",
                  },
                  {
                    label: METADATA_LABEL.version,
                    value: `v${usage.currentVersion}`,
                  },
                  {
                    label: "Latest version",
                    value: `v${usage.latestVersion}`,
                  },
                ]}
              />

              {usage.byVersion.length > 0 ? (
                <section className="rounded-lg border border-border bg-muted/20 p-4">
                  <h2 className="text-sm font-semibold">Pages by version</h2>
                  <ul className="mt-3 space-y-2 text-sm">
                    {usage.byVersion.map((row) => (
                      <li
                        key={row.version}
                        className="flex items-center justify-between gap-3"
                      >
                        <span>v{row.version}</span>
                        <span className="text-muted-foreground">
                          {formatStarterUsageTotal(row.count)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="rounded-lg border border-border bg-muted/20 p-4">
                <h2 className="text-sm font-semibold">Pages using this template</h2>
                {usage.pages.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No pages on this site were created from this starter yet.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-border text-sm">
                    {usage.pages.map((page) => (
                      <li key={page.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium text-foreground">{page.title}</span>
                          <Badge variant="outline">{page.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          /{page.slug} · v{page.sourceTemplateVersion} ·{" "}
                          {formatPreviewDate(page.instantiatedAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : (
            <p className="text-sm text-destructive">Usage analytics unavailable.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
