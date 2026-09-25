import * as React from "react";
import type { SerializedLayout } from "@ob-cms/block-schema";
import { useEditor } from "@craftjs/core";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getTemplateSkeletonByKeyRequest } from "@/views/template-catalog/api/template-skeletons.api";
import { CATEGORY_LABEL } from "@/views/template-catalog/lib/catalogLabels";
import { prefetchStarterSectionSkeleton } from "../lib/starterSectionSkeletonPrefetch";
import { LayoutPreviewPane } from "./LayoutPreviewPane";
import { prepareStarterSectionLayout } from "../craft/layoutSectionExtract";
import { layoutToCraft } from "../craft/serialize";
import { insertLayoutChildrenAtRoot } from "../craft/nodeOps";
import { normalizePreviewLayout } from "../lib/normalizePreviewLayout";
import {
  STARTER_SECTION_CATALOG,
  STARTER_SECTION_CATEGORIES,
  filterStarterSectionCatalog,
  starterSectionTemplateKeys,
  type StarterSectionCatalogEntry,
  type StarterSectionCategory,
} from "../sections/starterSectionCatalog";

export type InsertStarterSectionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const StarterSectionPreview: React.FC<{
  layout: SerializedLayout | null;
  loading: boolean;
  error: boolean;
  label: string;
}> = ({ layout, loading, error, label }) => (
  <LayoutPreviewPane
    layout={layout ? normalizePreviewLayout(layout) : null}
    loading={loading}
    error={error}
    label={label}
    className="aspect-[16/10] w-full"
  />
);

/** Browse and insert a platform starter section band into the current page. */
export const InsertStarterSectionDialog: React.FC<InsertStarterSectionDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { actions, query } = useEditor();
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<StarterSectionCategory | "all">("all");
  const [layouts, setLayouts] = React.useState<Map<string, SerializedLayout>>(new Map());
  const [loadingKeys, setLoadingKeys] = React.useState<Set<string>>(new Set());
  const [failedKeys, setFailedKeys] = React.useState<Set<string>>(new Set());
  const [insertingId, setInsertingId] = React.useState<string | null>(null);
  const [insertError, setInsertError] = React.useState<string | null>(null);
  const fetchedKeysRef = React.useRef<Set<string>>(new Set());

  const filtered = React.useMemo(
    () => filterStarterSectionCatalog(STARTER_SECTION_CATALOG, search, category),
    [search, category],
  );

  React.useEffect(() => {
    if (!open) return;
    for (const templateKey of starterSectionTemplateKeys()) {
      if (fetchedKeysRef.current.has(templateKey)) continue;
      setLoadingKeys((prev) => new Set(prev).add(templateKey));
      void prefetchStarterSectionSkeleton(templateKey, fetchedKeysRef.current, getTemplateSkeletonByKeyRequest)
        .then((result) => {
          if (result.status === "success") {
            setLayouts((prev) => new Map(prev).set(templateKey, result.layout));
            setFailedKeys((prev) => {
              if (!prev.has(templateKey)) return prev;
              const next = new Set(prev);
              next.delete(templateKey);
              return next;
            });
            return;
          }
          if (result.status === "failed") {
            setFailedKeys((prev) => new Set(prev).add(templateKey));
          }
        })
        .finally(() => {
          setLoadingKeys((prev) => {
            const next = new Set(prev);
            next.delete(templateKey);
            return next;
          });
        });
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      setSearch("");
      setCategory("all");
      setInsertError(null);
      setInsertingId(null);
    }
  }, [open]);

  const sectionLayouts = React.useMemo(() => {
    const byId = new Map<string, SerializedLayout | null>();
    for (const entry of STARTER_SECTION_CATALOG) {
      const pageLayout = layouts.get(entry.templateKey);
      if (!pageLayout) continue;
      try {
        byId.set(entry.id, prepareStarterSectionLayout(pageLayout, entry.bandIndex));
      } catch {
        byId.set(entry.id, null);
      }
    }
    return byId;
  }, [layouts]);

  const resolveSectionLayout = React.useCallback(
    (entry: StarterSectionCatalogEntry): SerializedLayout | null =>
      sectionLayouts.get(entry.id) ?? null,
    [sectionLayouts],
  );

  const handleInsert = React.useCallback(
    (entry: StarterSectionCatalogEntry): void => {
      setInsertError(null);
      setInsertingId(entry.id);
      try {
        const sectionLayout = resolveSectionLayout(entry);
        if (!sectionLayout) {
          throw new Error("Section layout is unavailable");
        }
        insertLayoutChildrenAtRoot(query, actions, layoutToCraft(sectionLayout));
        onOpenChange(false);
      } catch (err) {
        setInsertError(err instanceof Error ? err.message : "Could not insert section");
      } finally {
        setInsertingId(null);
      }
    },
    [actions, onOpenChange, query, resolveSectionLayout],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:w-full">
        <DialogHeader className="space-y-1 border-b border-border px-4 py-4 sm:px-6">
          <DialogTitle>Insert starter section</DialogTitle>
          <DialogDescription>
            Drop a live section band from platform starters onto this page. Layout previews use the
            same renderer as the template library.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search starter sections…"
              type="search"
              aria-label="Search starter sections"
              className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Filter by section category"
          >
            <button
              type="button"
              aria-pressed={category === "all"}
              onClick={() => setCategory("all")}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                category === "all"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            {STARTER_SECTION_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                aria-pressed={category === cat}
                onClick={() => setCategory(cat)}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                  category === cat
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {insertError ? (
            <p className="text-sm text-destructive" role="alert">
              {insertError}
            </p>
          ) : null}

          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No starter sections match your filters.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map((entry) => {
                const pageLayout = layouts.get(entry.templateKey);
                const isLoading = loadingKeys.has(entry.templateKey);
                const isFailed = failedKeys.has(entry.templateKey);
                const previewLayout = pageLayout ? resolveSectionLayout(entry) : null;
                const previewFailed = Boolean(pageLayout && !previewLayout);

                return (
                  <article
                    key={entry.id}
                    className="flex flex-col overflow-hidden rounded-lg border border-border bg-card"
                  >
                    <StarterSectionPreview
                      layout={previewLayout}
                      loading={isLoading}
                      error={isFailed || previewFailed}
                      label={`${entry.title} preview`}
                    />
                    <div className="flex flex-1 flex-col gap-3 p-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-sm font-semibold">{entry.title}</h3>
                          <Badge variant="secondary">{entry.category}</Badge>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {entry.description}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          From {CATEGORY_LABEL[entry.starterCategory] ?? entry.starterCategory} ·{" "}
                          <code className="rounded bg-muted px-1 py-0.5">{entry.templateKey}</code>
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="mt-auto w-full"
                        disabled={
                          isLoading ||
                          isFailed ||
                          previewFailed ||
                          insertingId === entry.id
                        }
                        onClick={() => handleInsert(entry)}
                      >
                        {insertingId === entry.id ? "Inserting…" : "Use Section"}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
