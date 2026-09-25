import * as React from "react";
import { Link } from "react-router";
import { useEditor } from "@craftjs/core";
import { Trash2, Plus, Layers } from "lucide-react";
import { Button } from "@/components/ui";
import { useConfirm } from "@/components/ui/confirm-provider";
import { useTemplates, useDeleteTemplate } from "@/views/templates/hooks/useTemplates";
import { resolveTemplateKind, type Template } from "@/views/templates/types";
import { TemplateLibraryToolbar } from "@/views/template-library/components/TemplateLibraryToolbar";
import {
  LOADING_MY_TEMPLATES_LABEL,
  MINE_TEMPLATE_DELETE_DESCRIPTION,
  MINE_TEMPLATES_EMPTY_FILTERED_PANEL,
  MINE_TEMPLATES_EMPTY_PANEL,
  TEMPLATE_LIBRARY_BROWSE_STARTERS_LABEL,
  templateKindLabelOrDefault,
} from "@/views/template-library/constants";
import type { MineKindFilter } from "@/views/template-library/lib/filterLibraryItems";
import { filterLibraryItems } from "@/views/template-library/lib/filterLibraryItems";
import { isSiteOwnedTemplate } from "@/views/template-library/lib/mineTemplateActions";
import { mineFilterSummary, mineFiltersActive } from "@/views/template-library/lib/mineFilterSummary";
import {
  sortMineLibraryItems,
  type MineSortId,
} from "@/views/template-library/lib/sortLibraryItems";
import { layoutToCraft } from "../craft/serialize";
import { buildLayoutDragTree, insertLayoutChildrenAtRoot } from "../craft/nodeOps";
import { InsertStarterSectionDialog } from "./InsertStarterSectionDialog";

const PanelSkeletonRows: React.FC = () => (
  <div className="flex flex-col gap-2" role="status" aria-busy="true" aria-live="polite">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="rounded-md border border-border p-2">
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-muted" />
      </div>
    ))}
    <span className="sr-only">{LOADING_MY_TEMPLATES_LABEL}…</span>
  </div>
);

type TemplatesPanelMode = "mine" | "starter-sections";

/**
 * Builder templates panel — site My Templates plus platform Starter Sections.
 */
export const TemplatesPanel: React.FC<{ siteId: string | null }> = ({ siteId }) => {
  const { data: templates = [], isLoading } = useTemplates(siteId);
  const del = useDeleteTemplate(siteId);
  const confirm = useConfirm();
  const { actions, query, connectors } = useEditor();
  const [panelMode, setPanelMode] = React.useState<TemplatesPanelMode>("mine");
  const [starterDialogOpen, setStarterDialogOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [kind, setKind] = React.useState<MineKindFilter>("all");
  const [sort, setSort] = React.useState<MineSortId>("updated-desc");

  const siteTemplates = React.useMemo(
    () => templates.filter((t) => isSiteOwnedTemplate(t.siteId, siteId)),
    [templates, siteId],
  );

  const mineItems = React.useMemo(
    () =>
      siteTemplates.map((template) => ({
        id: template.id,
        source: "mine" as const,
        title: template.name,
        description: "",
        preview: {},
        metadata: {
          siteId: template.siteId,
          kind: resolveTemplateKind(template.kind),
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
          canManage: true,
        },
        sourceData: template,
      })),
    [siteTemplates],
  );

  const filtered = React.useMemo(
    () => sortMineLibraryItems(filterLibraryItems(mineItems, search, kind), sort),
    [mineItems, search, kind, sort],
  );

  const insert = React.useCallback(
    (templateLayoutNodes: ReturnType<typeof layoutToCraft>): void => {
      insertLayoutChildrenAtRoot(query, actions, templateLayoutNodes);
    },
    [actions, query],
  );

  const handleDelete = async (template: Template): Promise<void> => {
    const ok = await confirm({
      title: `Delete “${template.name}”?`,
      description: MINE_TEMPLATE_DELETE_DESCRIPTION,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    del.mutate(template.id);
  };

  const clearFilters = (): void => {
    setSearch("");
    setKind("all");
  };

  const openStarterSections = (): void => {
    setPanelMode("starter-sections");
    setStarterDialogOpen(true);
  };

  if (!siteId) return <p className="p-4 text-xs text-muted-foreground">Select a site first.</p>;

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] leading-snug text-muted-foreground">
          Insert saved layouts or reusable starter section bands.
        </p>
        <div
          className="grid grid-cols-2 gap-1 rounded-md border border-border bg-muted/30 p-1"
          role="group"
          aria-label="Templates panel mode"
        >
          <button
            type="button"
            aria-pressed={panelMode === "mine"}
            className={`rounded-sm px-2 py-1.5 text-[11px] font-medium transition ${
              panelMode === "mine"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setPanelMode("mine")}
          >
            My Templates
          </button>
          <button
            type="button"
            aria-pressed={panelMode === "starter-sections"}
            className={`rounded-sm px-2 py-1.5 text-[11px] font-medium transition ${
              panelMode === "starter-sections"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={openStarterSections}
          >
            Starter Sections
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium">
          <Link to="/template-library" className="text-primary hover:underline">
            {TEMPLATE_LIBRARY_BROWSE_STARTERS_LABEL} →
          </Link>
          <Link to="/template-library?tab=mine" className="text-primary hover:underline">
            Manage →
          </Link>
        </div>
      </div>

      {panelMode === "starter-sections" ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-center">
          <Layers className="mx-auto mb-2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <p className="text-xs font-medium text-foreground">Starter Sections</p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Browse live hero, FAQ, pricing, and CTA bands from platform starters.
          </p>
          <Button type="button" size="sm" className="mt-3" onClick={() => setStarterDialogOpen(true)}>
            Browse starter sections
          </Button>
        </div>
      ) : (
        <>
          <TemplateLibraryToolbar
            variant="mine"
            search={search}
            onSearchChange={setSearch}
            kind={kind}
            onKindChange={setKind}
            sort={sort}
            onSortChange={setSort}
            showing={filtered.length}
            total={siteTemplates.length}
            filterSummary={mineFilterSummary(search, kind)}
            filtersActive={mineFiltersActive(search, kind)}
            onClearFilters={clearFilters}
          />
          {isLoading ? <PanelSkeletonRows /> : null}
          {!isLoading && siteTemplates.length === 0 && (
            <p className="text-xs text-muted-foreground">{MINE_TEMPLATES_EMPTY_PANEL}</p>
          )}
          {!isLoading && siteTemplates.length > 0 && filtered.length === 0 && (
            <p className="text-xs text-muted-foreground">{MINE_TEMPLATES_EMPTY_FILTERED_PANEL}</p>
          )}
          {!isLoading &&
            filtered.map((item) => {
              const t = item.sourceData;
              const craftMap = layoutToCraft(t.layout);
              return (
                <div
                  key={t.id}
                  ref={(ref) => {
                    if (!ref) return;
                    const root = craftMap["ROOT"] as { nodes?: string[] } | undefined;
                    if ((root?.nodes ?? []).length === 0) return;
                    connectors.create(ref, () => {
                      const tree = buildLayoutDragTree(query, craftMap);
                      if (!tree) throw new Error("Empty template");
                      return tree;
                    });
                  }}
                  className="flex cursor-grab items-center justify-between rounded-md border border-border bg-card p-2 active:cursor-grabbing"
                  title={`Drag “${t.name}” onto the canvas`}
                >
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{t.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {templateKindLabelOrDefault(t.kind)}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="Insert after selection"
                      onClick={(e) => {
                        e.stopPropagation();
                        insert(craftMap);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(t);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
        </>
      )}

      <InsertStarterSectionDialog
        open={starterDialogOpen}
        onOpenChange={setStarterDialogOpen}
      />
    </div>
  );
};
