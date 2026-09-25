import * as React from "react";
import { useEditor } from "@craftjs/core";
import { Search, Plus, Info, Text, Star, X } from "lucide-react";
import { Input } from "@/components/ui";
import { BLOCK_CATEGORIES, CATEGORY_ORDER } from "../blocks/categories";
import { CATEGORY_META } from "../blocks/categoryMeta";
import { metaFor, labelFor } from "../blocks/blockMeta";
import { iconFor } from "../blocks/blockIcons";
import { blockRegistry } from "@ob-cms/blocks";
import { useBlockInsert } from "../hooks/useBlockInsert";
import { useEditorUiStore } from "../store/editorUiStore";
import { fuzzyScore } from "../utils/fuzzyMatch";
import { RecommendedBlocks } from "./RecommendedBlocks";
import { BlockThumbnail } from "./BlockThumbnail";
import { BuilderTip } from "./BuilderTip";

/**
 * Component palette: all registry blocks with icons, friendly labels,
 * short descriptions, drag-to-insert, and a "+ Add" click-to-insert button.
 */
export const Palette: React.FC = () => {
  const [search, setSearch] = React.useState("");
  const term = search.trim().toLowerCase();
  const showDescriptions = useEditorUiStore((s) => s.showDescriptions);
  const toggleShowDescriptions = useEditorUiStore((s) => s.toggleShowDescriptions);
  const favoriteBlocks = useEditorUiStore((s) => s.favoriteBlocks);
  const recentBlocks = useEditorUiStore((s) => s.recentBlocks);

  const favorites = React.useMemo(
    () => favoriteBlocks.filter((name) => blockRegistry[name] && matchesSearch(name, term)),
    [favoriteBlocks, term],
  );

  const recent = React.useMemo(
    () =>
      recentBlocks.filter(
        (name) =>
          blockRegistry[name] &&
          matchesSearch(name, term) &&
          !favoriteBlocks.includes(name),
      ),
    [recentBlocks, favoriteBlocks, term],
  );

  const filtered = React.useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        names: BLOCK_CATEGORIES[category]
          .filter((name) => matchesSearch(name, term))
          .sort((a, b) => searchScore(b, term) - searchScore(a, term)),
      })).filter((g) => g.names.length > 0),
    [term],
  );

  const searchResultCount = React.useMemo(
    () => filtered.reduce((n, g) => n + g.names.length, 0),
    [filtered],
  );

  return (
    <div className="flex min-h-0 flex-col">
      {/* Search pinned at top so it is always visible in the Blocks tab */}
      <div className="sticky top-0 z-10 flex shrink-0 flex-col gap-2 border-b border-border bg-card p-3 pb-2">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search blocks… (menu, hero, form…)"
              className="h-8 pl-8 pr-8 text-xs"
              aria-label="Search blocks"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <BuilderTip content={showDescriptions ? "Hide block descriptions" : "Show block descriptions"}>
            <button
              type="button"
              onClick={toggleShowDescriptions}
              aria-pressed={showDescriptions}
              aria-label="Toggle block descriptions"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors ${
                showDescriptions
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <Text className="h-3.5 w-3.5" />
            </button>
          </BuilderTip>
        </div>
        {term ? (
          <p className="px-0.5 text-[10px] text-muted-foreground">
            {searchResultCount === 0
              ? `No blocks match “${search.trim()}”`
              : `${searchResultCount} block${searchResultCount === 1 ? "" : "s"} found`}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 p-3 pt-2">
      {!term && <RecommendedBlocks />}

      {favorites.length > 0 && !term && (
        <div className="flex flex-col gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Favorites
          </h4>
          {favorites.map((name) => (
            <PaletteItem key={`fav-${name}`} name={name} showDescriptions={showDescriptions} />
          ))}
        </div>
      )}

      {!term && recent.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Recent
          </h4>
          {recent.map((name) => (
            <PaletteItem key={`recent-${name}`} name={name} showDescriptions={showDescriptions} />
          ))}
        </div>
      )}

      {filtered.length === 0 && term ? (
        <p className="px-1 py-4 text-center text-xs text-muted-foreground">
          Try “hero”, “form”, “navbar”, or “gallery”.
        </p>
      ) : (
        filtered.map(({ category, names }) => (
          <div key={category} className="flex flex-col gap-1.5">
            <div className="px-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {term ? `Results · ${category}` : category}
              </p>
              {!term ? (
                <p className="text-[10px] leading-snug text-muted-foreground/80">
                  {CATEGORY_META[category].description}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              {names.map((name) => (
                <PaletteItem key={name} name={name} showDescriptions={showDescriptions} />
              ))}
            </div>
          </div>
        ))
      )}

      </div>
    </div>
  );
};

const searchScore = (name: string, term: string): number => {
  if (!term) return 0;
  const meta = metaFor(name);
  const label = labelFor(name);
  return Math.max(
    fuzzyScore(label, term),
    fuzzyScore(name, term),
    fuzzyScore(meta.summary, term),
    ...(meta.keywords ?? []).map((k) => fuzzyScore(k, term)),
  );
};

const matchesSearch = (name: string, term: string): boolean => {
  if (!term) return true;
  return searchScore(name, term) > 0;
};

const PaletteItem: React.FC<{ name: string; showDescriptions: boolean }> = React.memo(({ name, showDescriptions }) => {
  const { connectors } = useEditor();
  const { makeElement, insert } = useBlockInsert();
  const isFavorite = useEditorUiStore((s) => s.favoriteBlocks.includes(name));
  const toggleFavoriteBlock = useEditorUiStore((s) => s.toggleFavoriteBlock);
  const entry = blockRegistry[name];
  const meta = metaFor(name);
  const label = labelFor(name);
  const Icon = iconFor(name);
  const tip = [meta.summary, meta.whenToUse, meta.placement].filter(Boolean).join("\n\n");

  const attachDrag = React.useCallback(
    (ref: HTMLDivElement | null) => {
      const el = makeElement(name);
      if (ref && el) connectors.create(ref, el);
    },
    [connectors, makeElement, name],
  );

  if (!entry) return null;

  return (
    <article className="group flex flex-col -mx-4 overflow-x-auto rounded-lg border border-border px-4 sm:mx-0 sm:px-0 bg-card transition-colors hover:border-primary">
      <div
        ref={attachDrag}
        className="cursor-grab px-2 pt-2 active:cursor-grabbing"
        aria-label={`Drag ${label} onto canvas`}
      >
        <BlockThumbnail name={name} />
      </div>

      <div className="flex flex-col gap-1 px-2.5 pb-2.5 pt-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-1.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-xs font-semibold leading-tight text-foreground">{label}</span>
                {tip && (
                  <BuilderTip content={tip}>
                    <button
                      type="button"
                      className="shrink-0 text-muted-foreground/70 transition-colors hover:text-foreground"
                      aria-label={`About ${label}`}
                    >
                      <Info className="h-3 w-3" />
                    </button>
                  </BuilderTip>
                )}
              </div>
              {label !== name && (
                <span className="text-[10px] text-muted-foreground/70">{name}</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <BuilderTip content={isFavorite ? "Remove from favorites" : "Add to favorites"}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavoriteBlock(name);
                }}
                aria-label={isFavorite ? `Unfavorite ${label}` : `Favorite ${label}`}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-border transition-colors ${
                  isFavorite ? "text-amber-500" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Star className={`h-3.5 w-3.5 ${isFavorite ? "fill-current" : ""}`} />
              </button>
            </BuilderTip>
            <BuilderTip content={`Add ${label} to the page`}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                insert(name);
              }}
              className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
              aria-label={`Add ${label}`}
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </BuilderTip>
          </div>
        </div>
        {showDescriptions && (
          <>
            <p className="line-clamp-2 pl-[1.875rem] text-[11px] leading-snug text-muted-foreground">
              {meta.summary}
            </p>
            {meta.whenToUse && (
              <p className="line-clamp-2 pl-[1.875rem] text-[10px] leading-snug text-muted-foreground/80">
                {meta.whenToUse}
              </p>
            )}
          </>
        )}
      </div>
    </article>
  );
});
PaletteItem.displayName = "PaletteItem";
