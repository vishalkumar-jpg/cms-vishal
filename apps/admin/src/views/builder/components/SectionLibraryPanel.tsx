import * as React from "react";
import { useEditor } from "@craftjs/core";
import { Search, Plus } from "lucide-react";
import { Input, Button } from "@/components/ui";
import { layoutToCraft } from "../craft/serialize";
import { insertLayoutChildrenAtRoot, buildLayoutDragTree } from "../craft/nodeOps";
import {
  SECTION_PRESETS,
  SECTION_CATEGORIES,
  SECTION_GROUPS,
  presetGroup,
  sectionLayout,
  resolvePresetLayout,
  preloadObHomepageLayout,
  preloadObHowItWorksLayout,
  loadObHomepageLayout,
  loadObHowItWorksLayout,
  isPresetLayoutReady,
  type SectionPreset,
} from "../sections/sectionPresets";
import { expandLayoutComposites } from "../sections/expandComposite";

/**
 * Build the Craft node map for a preset with every composite block expanded to
 * editable primitives — so anything dropped from the Section Library is a fully
 * node-based, selectable/editable tree (never a hidden-JSX composite).
 */
const presetCraftMapSync = (preset: SectionPreset): Record<string, unknown> =>
  expandLayoutComposites(layoutToCraft(sectionLayout(preset))).nodes;

const presetCraftMapAsync = async (
  preset: SectionPreset,
): Promise<Record<string, unknown>> => {
  const layout = await resolvePresetLayout(preset);
  return expandLayoutComposites(layoutToCraft(layout)).nodes;
};

/**
 * SECTION / PATTERN LIBRARY panel — a gallery of pre-built, theme-aware sections
 * (hero, features, pricing, FAQ, CTA, testimonials, logos, stats, team, content)
 * a marketer drops onto a page in one click. Mirrors the TemplatesPanel insert
 * mechanism: each preset is turned into a `SerializedLayout` (root "ROOT") via
 * `sectionLayout`, run through `layoutToCraft`, then each top-level child under
 * ROOT is rebuilt into a Craft NodeTree (`buildTreeFromSerializedMap`) and added
 * under the canvas ROOT — appended, or inserted right after the current
 * selection. `sectionLayout` mints FRESH ids on every call, so dropping the same
 * preset twice never collides, and inserted nodes are normal, editable blocks.
 */
export const SectionLibraryPanel: React.FC = () => {
  const { actions, query, connectors } = useEditor();
  const [activeCat, setActiveCat] = React.useState<string>("All");
  const [search, setSearch] = React.useState("");
  const [insertingIds, setInsertingIds] = React.useState<Set<string>>(new Set());
  const [asyncPresetsReady, setAsyncPresetsReady] = React.useState(false);

  React.useEffect(() => {
    preloadObHomepageLayout();
    preloadObHowItWorksLayout();
    void Promise.all([loadObHomepageLayout(), loadObHowItWorksLayout()]).finally(() =>
      setAsyncPresetsReady(true),
    );
  }, []);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return SECTION_PRESETS.filter((p) => {
      if (activeCat !== "All" && p.category !== activeCat) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    });
  }, [activeCat, search]);

  /**
   * Insert a preset. Builds a fresh (unique-id) layout, then appends each
   * top-level child under ROOT — inserting AFTER the current selection's
   * top-level ancestor when one exists, else appending to the page root.
   */
  const insert = React.useCallback(
    (preset: SectionPreset): void => {
      setInsertingIds((prev) => new Set(prev).add(preset.id));
      void presetCraftMapAsync(preset)
        .then((map) => insertLayoutChildrenAtRoot(query, actions, map))
        .finally(() =>
          setInsertingIds((prev) => {
            const next = new Set(prev);
            next.delete(preset.id);
            return next;
          }),
        );
    },
    [actions, query],
  );

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search sections…"
          className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-2 text-xs outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-1">
        {["All", ...SECTION_CATEGORIES].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCat(cat)}
            className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
              activeCat === cat
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grouped card grid (Built-in Components → Section Starters → Quick Layouts) */}
      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground">No sections match your search.</p>
      ) : (
        SECTION_GROUPS.map((group) => {
          const items = filtered.filter((p) => presetGroup(p) === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="flex flex-col gap-2">
              <h4 className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group}
              </h4>
              {items.map((preset) => (
                <div
                  key={preset.id}
                  ref={(ref) => {
                    if (!ref || !asyncPresetsReady || !isPresetLayoutReady(preset)) return;
                    let map: Record<string, unknown>;
                    try {
                      map = presetCraftMapSync(preset);
                    } catch {
                      return;
                    }
                    const root = map["ROOT"] as { nodes?: string[] } | undefined;
                    if ((root?.nodes ?? []).length === 0) return;
                    connectors.create(ref, () => {
                      const tree = buildLayoutDragTree(query, map);
                      if (!tree) throw new Error("Empty section preset");
                      return tree;
                    });
                  }}
                  className="group flex cursor-grab items-start gap-2 rounded-lg border border-border bg-card p-2 transition hover:border-primary active:cursor-grabbing"
                  title={`Drag “${preset.name}” onto the canvas`}
                >
                  <button
                    type="button"
                    onClick={() => insert(preset)}
                    disabled={insertingIds.has(preset.id)}
                    className="flex min-w-0 flex-1 flex-col gap-1.5 text-left"
                  >
                    <SectionThumb preset={preset} />
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-foreground">{preset.name}</span>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {preset.category}
                      </span>
                    </div>
                    <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                      {preset.description}
                    </span>
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    title={`Insert “${preset.name}”`}
                    disabled={insertingIds.has(preset.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      insert(preset);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
};

/**
 * A lightweight CSS thumbnail — a schematic, category-shaped preview using theme
 * tokens so the swatch matches the tenant brand (no rendered Craft tree needed).
 */
const SectionThumb: React.FC<{ preset: SectionPreset }> = ({ preset }) => {
  const bars = THUMB_SHAPES[preset.category] ?? THUMB_SHAPES.Content;
  return (
    <div
      aria-hidden
      className="flex h-16 w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-md border border-border"
      style={{ background: "hsl(var(--muted))" }}
    >
      {bars}
    </div>
  );
};

const bar = (w: string, h = 6, primary = false, round = 3): React.ReactNode => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: round,
      background: primary ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.35)",
    }}
  />
);

const cols = (count: number): React.ReactNode => (
  <div style={{ display: "flex", gap: 4, width: "70%" }}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} style={{ flex: 1, height: 18, borderRadius: 3, background: "hsl(var(--muted-foreground) / 0.25)" }} />
    ))}
  </div>
);

/** Per-category schematic shapes (theme-token colored). */
const THUMB_SHAPES: Record<string, React.ReactNode> = {
  Hero: (
    <>
      {bar("55%", 7)}
      {bar("40%", 5)}
      {bar("22%", 8, true, 4)}
    </>
  ),
  Features: cols(3),
  CTA: (
    <>
      {bar("60%", 6)}
      {bar("26%", 9, true, 4)}
    </>
  ),
  Pricing: cols(3),
  FAQ: (
    <>
      {bar("70%", 6)}
      {bar("70%", 6)}
      {bar("70%", 6)}
    </>
  ),
  Testimonials: (
    <>
      {bar("65%", 6)}
      {bar("45%", 5)}
      {bar("18%", 12, false, 999)}
    </>
  ),
  Stats: cols(4),
  Team: cols(4),
  Gallery: cols(3),
  Blog: cols(3),
  Cards: cols(3),
  Layout: cols(2),
  Footer: cols(4),
  Timeline: (
    <>
      {bar("70%", 6)}
      {bar("70%", 6)}
      {bar("70%", 6)}
    </>
  ),
  Navigation: (
    <div style={{ display: "flex", gap: 6, width: "80%", alignItems: "center", justifyContent: "space-between" }}>
      {bar("20%", 8, true, 3)}
      <div style={{ display: "flex", gap: 6 }}>
        {bar("16px", 5)}
        {bar("16px", 5)}
        {bar("16px", 5)}
      </div>
    </div>
  ),
  Contact: (
    <div style={{ display: "flex", gap: 6, width: "72%", alignItems: "center" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {bar("100%", 5)}
        {bar("70%", 5)}
      </div>
      <div style={{ flex: 1, height: 34, borderRadius: 4, background: "hsl(var(--muted-foreground) / 0.25)" }} />
    </div>
  ),
  Logos: (
    <div style={{ display: "flex", gap: 6, width: "75%", justifyContent: "center" }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ width: 22, height: 10, borderRadius: 2, background: "hsl(var(--muted-foreground) / 0.3)" }} />
      ))}
    </div>
  ),
  Content: (
    <div style={{ display: "flex", gap: 6, width: "72%", alignItems: "center" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {bar("100%", 5)}
        {bar("80%", 5)}
        {bar("40%", 7, true, 3)}
      </div>
      <div style={{ flex: 1, height: 32, borderRadius: 4, background: "hsl(var(--muted-foreground) / 0.25)" }} />
    </div>
  ),
};
