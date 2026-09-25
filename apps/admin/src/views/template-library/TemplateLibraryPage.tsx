import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui";
import { useConfirm } from "@/components/ui/confirm-provider";
import { toast } from "@/components/ui/toaster";
import { useSiteStore } from "@/store/siteStore";
import { prefetchBuilderBundle } from "@/views/builder/craft/layoutPrep";
import { CreatePageDialog } from "@/views/pages/components/CreatePageDialog";
import { TemplatePreviewDialog } from "@/views/template-catalog/components/TemplatePreviewDialog";
import { UseTemplateDialog } from "@/views/template-catalog/components/UseTemplateDialog";
import { builderPathForPage } from "@/views/template-catalog/lib/catalogFlow";
import { filterTemplateCatalogEntries } from "@/views/template-catalog/lib/filterTemplateCatalogEntries";
import {
  canUseTemplate,
  closePreviewDialog,
  openPreviewDialog,
  type PreviewDialogState,
} from "@/views/template-catalog/lib/templatePreview";
import type { TemplateCatalogCategory, TemplateCatalogEntry } from "@/views/template-catalog/types";
import {
  useCreateTemplate,
  useDeleteTemplate,
  useUpdateTemplate,
} from "@/views/templates/hooks/useTemplates";
import { RenameMineTemplateDialog } from "./components/RenameMineTemplateDialog";
import { TemplateLibraryCard } from "./components/TemplateLibraryCard";
import { TemplateLibraryFeaturedRow } from "./components/TemplateLibraryFeaturedRow";
import { TemplateLibraryGrid } from "./components/TemplateLibraryGrid";
import { TemplateLibraryMinePreviewDialog } from "./components/TemplateLibraryMinePreviewDialog";
import { TemplateLibraryPageHeader } from "./components/TemplateLibraryPageHeader";
import { TemplateLibraryTabs } from "./components/TemplateLibraryTabs";
import { TemplateLibraryToolbar } from "./components/TemplateLibraryToolbar";
import { useTemplateLibrary } from "./hooks/useTemplateLibrary";
import {
  usageCountByTemplateKey,
  useTopTemplateUsage,
} from "./hooks/useTemplateSkeletonUsage";
import { resolveInsertInBuilderPath } from "./lib/builderNavigation";
import { filterLibraryItems, type MineKindFilter } from "./lib/filterLibraryItems";
import { duplicateTemplateName } from "./lib/mineTemplateActions";
import { mineFilterSummary, mineFiltersActive } from "./lib/mineFilterSummary";
import { parseTemplateLibraryTab } from "./lib/templateLibraryTab";
import {
  shouldShowFeaturedShelf,
  starterFilterSummary,
  starterFiltersActive,
} from "./lib/starterFilterSummary";
import {
  sortMineLibraryItems,
  sortStarterLibraryItems,
  type MineSortId,
  type StarterSortId,
} from "./lib/sortLibraryItems";
import type { TemplateLibraryMineItem } from "./types";
import {
  CLEAR_FILTERS_LABEL,
  LOADING_MY_TEMPLATES_LABEL,
  LOADING_STARTER_TEMPLATES_LABEL,
  MINE_TEMPLATE_DELETE_DESCRIPTION_WITH_PAGES,
  MINE_TEMPLATES_EMPTY_FILTERED,
  MINE_TEMPLATES_EMPTY_LIBRARY,
  STARTER_TEMPLATES_EMPTY,
  STARTER_TEMPLATES_EMPTY_FILTERED,
} from "./constants";

/**
 * Unified Template Library — starter catalog + site-scoped saved templates.
 * Starter flow reuses catalog preview/create dialogs unchanged.
 */
export const TemplateLibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = parseTemplateLibraryTab(searchParams.get("tab"));
  const confirm = useConfirm();
  const siteId = useSiteStore((s) => s.activeSiteId);
  const { starterItems, mineItems, loading, error, refetch } = useTemplateLibrary();
  const { data: topUsage } = useTopTemplateUsage(activeTab === "starter" && !!siteId);
  const usageByTemplateKey = React.useMemo(
    () => usageCountByTemplateKey(topUsage),
    [topUsage],
  );
  const createTemplate = useCreateTemplate(siteId);
  const deleteTemplate = useDeleteTemplate(siteId);
  const updateTemplate = useUpdateTemplate(siteId);

  const [starterSearch, setStarterSearch] = React.useState("");
  const [starterCategory, setStarterCategory] = React.useState<TemplateCatalogCategory | "all">(
    "all",
  );
  const [starterFeaturedOnly, setStarterFeaturedOnly] = React.useState(false);
  const [starterSort, setStarterSort] = React.useState<StarterSortId>("name-asc");
  const [mineSearch, setMineSearch] = React.useState("");
  const [mineKind, setMineKind] = React.useState<MineKindFilter>("all");
  const [mineSort, setMineSort] = React.useState<MineSortId>("updated-desc");
  const [starterPreview, setStarterPreview] = React.useState<PreviewDialogState>(
    closePreviewDialog(),
  );
  const [useTemplate, setUseTemplate] = React.useState<TemplateCatalogEntry | null>(null);
  const [useDialogOpen, setUseDialogOpen] = React.useState(false);
  const [minePreviewItem, setMinePreviewItem] = React.useState<TemplateLibraryMineItem | null>(
    null,
  );
  const [minePreviewOpen, setMinePreviewOpen] = React.useState(false);
  const [renameItem, setRenameItem] = React.useState<TemplateLibraryMineItem | null>(null);
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [createPageOpen, setCreatePageOpen] = React.useState(false);

  const filteredStarterItems = React.useMemo(() => {
    const entries = starterItems.map((item) => item.sourceData);
    const filteredEntries = filterTemplateCatalogEntries(
      entries,
      starterSearch,
      starterCategory,
      { featuredOnly: starterFeaturedOnly },
    );
    const allowedIds = new Set(filteredEntries.map((entry) => entry.id));
    const filtered = starterItems.filter((item) => allowedIds.has(item.id));
    return sortStarterLibraryItems(filtered, starterSort);
  }, [starterItems, starterSearch, starterCategory, starterFeaturedOnly, starterSort]);

  const showFeaturedShelf = shouldShowFeaturedShelf({
    search: starterSearch,
    category: starterCategory,
    featuredOnly: starterFeaturedOnly,
  });

  const starterGridItems = React.useMemo(() => {
    if (!showFeaturedShelf) return filteredStarterItems;
    return filteredStarterItems.filter((item) => !item.metadata.featured);
  }, [filteredStarterItems, showFeaturedShelf]);

  const starterCatalogEntries = React.useMemo(
    () => starterItems.map((item) => item.sourceData),
    [starterItems],
  );

  const filteredMineItems = React.useMemo(() => {
    const filtered = filterLibraryItems(mineItems, mineSearch, mineKind);
    return sortMineLibraryItems(filtered, mineSort);
  }, [mineItems, mineSearch, mineKind, mineSort]);

  const starterFiltersActiveState = starterFiltersActive({
    search: starterSearch,
    category: starterCategory,
    featuredOnly: starterFeaturedOnly,
  });
  const mineFiltersActiveState = mineFiltersActive(mineSearch, mineKind);

  const clearStarterFilters = (): void => {
    setStarterSearch("");
    setStarterCategory("all");
    setStarterFeaturedOnly(false);
  };

  const clearMineFilters = (): void => {
    setMineSearch("");
    setMineKind("all");
  };

  const closeMinePreviewIf = (itemId: string): void => {
    if (minePreviewItem?.id === itemId) {
      setMinePreviewOpen(false);
      setMinePreviewItem(null);
    }
  };

  const openStarterPreview = (entry: TemplateCatalogEntry): void => {
    setStarterPreview(openPreviewDialog(entry));
  };

  const openUseTemplate = (entry: TemplateCatalogEntry): void => {
    if (!canUseTemplate(entry.status)) return;
    setStarterPreview(closePreviewDialog());
    setUseTemplate(entry);
    setUseDialogOpen(true);
  };

  const openBuilderForNewPage = (pageId: string): void => {
    prefetchBuilderBundle();
    void navigate(builderPathForPage(pageId));
  };

  const openBuilderForMine = (): void => {
    if (!siteId) return;
    const path = resolveInsertInBuilderPath(siteId);
    if (path) {
      prefetchBuilderBundle();
      void navigate(path);
      return;
    }
    void (async () => {
      const ok = await confirm({
        title: "No page open in builder",
        description:
          "To insert from My Templates, you need a page open in the builder. Would you like to create a new blank page first?",
        confirmLabel: "Create new page",
        cancelLabel: "Cancel",
      });
      if (ok) setCreatePageOpen(true);
    })();
  };

  const openMinePreview = (item: TemplateLibraryMineItem): void => {
    setMinePreviewItem(item);
    setMinePreviewOpen(true);
  };

  const openMineRename = (item: TemplateLibraryMineItem): void => {
    if (!item.metadata.canManage) return;
    setRenameItem(item);
    setRenameOpen(true);
  };

  const handleMineRename = async (
    item: TemplateLibraryMineItem,
    name: string,
  ): Promise<void> => {
    try {
      await updateTemplate.mutateAsync({ templateId: item.id, payload: { name } });
      toast.success("Template renamed");
      if (minePreviewItem?.id === item.id) {
        setMinePreviewItem({ ...item, title: name, sourceData: { ...item.sourceData, name } });
      }
    } catch {
      toast.error("Could not rename template");
      throw new Error("Could not rename template");
    }
  };

  const handleMineDuplicate = async (item: TemplateLibraryMineItem): Promise<void> => {
    if (!item.metadata.canManage) return;
    if (createTemplate.isPending) return;
    try {
      await createTemplate.mutateAsync({
        name: duplicateTemplateName(item.title),
        layout: item.sourceData.layout,
        kind: item.sourceData.kind,
      });
      toast.success("Template duplicated");
    } catch {
      toast.error("Could not duplicate template");
    }
  };

  const handleMineDelete = async (item: TemplateLibraryMineItem): Promise<void> => {
    if (!item.metadata.canManage) return;
    const ok = await confirm({
      title: `Delete “${item.title}”?`,
      description: MINE_TEMPLATE_DELETE_DESCRIPTION_WITH_PAGES,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteTemplate.mutateAsync(item.id);
      closeMinePreviewIf(item.id);
      toast.success("Template deleted");
    } catch {
      toast.error("Could not delete template");
    }
  };

  const starterEmptyText =
    starterItems.length === 0 ? STARTER_TEMPLATES_EMPTY : STARTER_TEMPLATES_EMPTY_FILTERED;

  const mineEmptyText =
    mineItems.length === 0 ? MINE_TEMPLATES_EMPTY_LIBRARY : MINE_TEMPLATES_EMPTY_FILTERED;

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
      <TemplateLibraryPageHeader
        activeTab={activeTab}
        siteSelected={Boolean(siteId)}
        onCreateBlankPage={() => setCreatePageOpen(true)}
        onOpenBuilder={openBuilderForMine}
      />

      {!siteId ? (
        <div
          className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground"
          role="status"
        >
          Select a site to browse the Template Library.
        </div>
      ) : error ? (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 py-16 text-center"
          role="alert"
        >
          <p className="text-sm text-destructive">
            Could not load the Template Library. Try again later.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <TemplateLibraryTabs
          starterContent={
            <>
              <TemplateLibraryToolbar
                variant="starter"
                search={starterSearch}
                onSearchChange={setStarterSearch}
                category={starterCategory}
                onCategoryChange={setStarterCategory}
                featuredOnly={starterFeaturedOnly}
                onFeaturedOnlyChange={setStarterFeaturedOnly}
                sort={starterSort}
                onSortChange={setStarterSort}
                showing={filteredStarterItems.length}
                total={starterItems.length}
                filterSummary={starterFilterSummary({
                  search: starterSearch,
                  category: starterCategory,
                  featuredOnly: starterFeaturedOnly,
                })}
                filtersActive={starterFiltersActiveState}
                onClearFilters={clearStarterFilters}
              />
              {showFeaturedShelf ? (
                <TemplateLibraryFeaturedRow
                  entries={starterCatalogEntries}
                  usageByTemplateKey={usageByTemplateKey}
                  onPreview={openStarterPreview}
                  onUseTemplate={openUseTemplate}
                />
              ) : null}
              <TemplateLibraryGrid
                isLoading={loading}
                isEmpty={filteredStarterItems.length === 0}
                emptyText={starterEmptyText}
                loadingLabel={LOADING_STARTER_TEMPLATES_LABEL}
                emptyAction={
                  starterFiltersActiveState ? (
                    <Button type="button" variant="outline" size="sm" onClick={clearStarterFilters}>
                      {CLEAR_FILTERS_LABEL}
                    </Button>
                  ) : undefined
                }
              >
                {starterGridItems.map((item) => (
                  <TemplateLibraryCard
                    key={item.id}
                    item={item}
                    usageCount={usageByTemplateKey.get(item.sourceData.templateKey)}
                    onStarterPreview={openStarterPreview}
                    onStarterUseTemplate={openUseTemplate}
                  />
                ))}
              </TemplateLibraryGrid>
            </>
          }
          mineContent={
            <>
              <TemplateLibraryToolbar
                variant="mine"
                search={mineSearch}
                onSearchChange={setMineSearch}
                kind={mineKind}
                onKindChange={setMineKind}
                sort={mineSort}
                onSortChange={setMineSort}
                showing={filteredMineItems.length}
                total={mineItems.length}
                filterSummary={mineFilterSummary(mineSearch, mineKind)}
                filtersActive={mineFiltersActiveState}
                onClearFilters={clearMineFilters}
              />
              <TemplateLibraryGrid
                isLoading={loading}
                isEmpty={filteredMineItems.length === 0}
                emptyText={mineEmptyText}
                loadingLabel={LOADING_MY_TEMPLATES_LABEL}
                emptyAction={
                  mineItems.length === 0 ? (
                    <Button type="button" variant="outline" size="sm" asChild>
                      <Link to="/pages">Go to Pages</Link>
                    </Button>
                  ) : mineFiltersActiveState ? (
                    <Button type="button" variant="outline" size="sm" onClick={clearMineFilters}>
                      {CLEAR_FILTERS_LABEL}
                    </Button>
                  ) : undefined
                }
              >
                {filteredMineItems.map((item) => (
                  <TemplateLibraryCard
                    key={item.id}
                    item={item}
                    onMinePreview={openMinePreview}
                    onMineRename={openMineRename}
                    onMineDuplicate={(target) => void handleMineDuplicate(target)}
                    onMineDelete={(target) => void handleMineDelete(target)}
                    onMineOpenBuilder={openBuilderForMine}
                  />
                ))}
              </TemplateLibraryGrid>
            </>
          }
        />
      )}

      <TemplatePreviewDialog
        template={starterPreview.template}
        open={starterPreview.open}
        onOpenChange={(open) => {
          if (!open) setStarterPreview(closePreviewDialog());
        }}
        onUseTemplate={openUseTemplate}
      />

      <UseTemplateDialog
        siteId={siteId}
        template={useTemplate}
        open={useDialogOpen}
        onOpenChange={(open) => {
          setUseDialogOpen(open);
          if (!open) setUseTemplate(null);
        }}
        onCreated={openBuilderForNewPage}
      />

      <TemplateLibraryMinePreviewDialog
        item={minePreviewItem}
        open={minePreviewOpen}
        onOpenChange={(open) => {
          setMinePreviewOpen(open);
          if (!open) setMinePreviewItem(null);
        }}
        onOpenBuilder={openBuilderForMine}
      />

      <RenameMineTemplateDialog
        item={renameItem}
        open={renameOpen}
        onOpenChange={(open) => {
          setRenameOpen(open);
          if (!open) setRenameItem(null);
        }}
        onRename={handleMineRename}
        isPending={updateTemplate.isPending}
      />

      <CreatePageDialog
        siteId={siteId}
        open={createPageOpen}
        onOpenChange={setCreatePageOpen}
        onCreated={openBuilderForNewPage}
      />
    </div>
  );
};
