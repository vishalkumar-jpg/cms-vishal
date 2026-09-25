import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useNavigate } from "react-router";
import {
  Search,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  FileText,
  Newspaper,
  Image,
  Database,
  FormInput,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useSearch } from "@/views/search/hooks/useSearch";
import type { SearchHit, SearchType } from "@/views/search/api/search.api";
import { NAV_GROUPS } from "./AppShell";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** A flat, selectable row in the palette (nav command OR content hit). */
interface PaletteItem {
  key: string;
  group: string;
  label: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  url: string;
}

/** Debounce a fast-changing value (the search query). */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

const TYPE_META: Record<SearchType, { group: string; icon: PaletteItem["icon"] }> = {
  page: { group: "Pages", icon: FileText },
  post: { group: "Posts", icon: Newspaper },
  media: { group: "Media", icon: Image },
  collection: { group: "Collections", icon: Database },
  collectionItem: { group: "Collection items", icon: Database },
  form: { group: "Forms", icon: FormInput },
};

/** Display order for content-search result groups. */
const TYPE_ORDER: SearchType[] = ["page", "post", "media", "collection", "collectionItem", "form"];

/**
 * Global ⌘K command palette. Mounted once in AppShell, available on every
 * shell screen. Two modes:
 *  - empty query → "Go to" navigation commands (derived from NAV_GROUPS).
 *  - typing → debounced content search grouped by type (Pages/Posts/…).
 * Keyboard: ↑/↓ move, Enter selects, Esc closes (Esc handled by Radix Dialog).
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onOpenChange }) => {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const debounced = useDebounced(query.trim(), 200);
  const { data: hits = [], isFetching } = useSearch(debounced);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Reset state each time the palette opens.
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  // Navigation commands derived from the sidebar — the empty/recent state.
  const navItems = React.useMemo<PaletteItem[]>(
    () =>
      NAV_GROUPS.flatMap((g) => g.items).map((item) => ({
        key: `nav:${item.to}`,
        group: "Go to",
        label: item.label,
        icon: item.icon,
        url: item.to,
      })),
    [],
  );

  const hasQuery = debounced.length >= 2;

  // Content hits grouped by type, then flattened in display order.
  const resultItems = React.useMemo<PaletteItem[]>(() => {
    const byType = new Map<SearchType, SearchHit[]>();
    for (const hit of hits) {
      const arr = byType.get(hit.type) ?? [];
      arr.push(hit);
      byType.set(hit.type, arr);
    }
    const out: PaletteItem[] = [];
    for (const type of TYPE_ORDER) {
      for (const hit of byType.get(type) ?? []) {
        out.push({
          key: `${hit.type}:${hit.id}`,
          group: TYPE_META[type].group,
          label: hit.title,
          subtitle: hit.subtitle,
          icon: TYPE_META[type].icon,
          url: hit.url,
        });
      }
    }
    return out;
  }, [hits]);

  const items = hasQuery ? resultItems : navItems;

  // Keep the active index in range as the list changes.
  React.useEffect(() => {
    setActive((a) => (items.length === 0 ? 0 : Math.min(a, items.length - 1)));
  }, [items.length]);

  const select = React.useCallback(
    (item: PaletteItem | undefined) => {
      if (!item) return;
      onOpenChange(false);
      navigate(item.url);
    },
    [navigate, onOpenChange],
  );

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (items.length === 0 ? 0 : (a + 1) % items.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (items.length === 0 ? 0 : (a - 1 + items.length) % items.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(items[active]);
    }
  };

  // Scroll the active row into view as the user arrows through.
  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // Render rows with group headers (a header precedes the first row of a group).
  let lastGroup = "";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onKeyDown={onKeyDown}
          aria-label="Command palette"
          className="fixed left-1/2 top-[15%] z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search content or jump to a screen.
          </DialogPrimitive.Description>

          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              placeholder="Search pages, posts, media… or jump to a screen"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {isFetching && hasQuery && (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            )}
          </div>

          <div ref={listRef} className="max-h-[22rem] overflow-y-auto p-2">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {hasQuery && !isFetching ? "No results found." : "Type to search…"}
              </p>
            ) : (
              items.map((item, i) => {
                const showHeader = item.group !== lastGroup;
                lastGroup = item.group;
                const isActive = i === active;
                const Icon = item.icon;
                return (
                  <React.Fragment key={item.key}>
                    {showHeader && (
                      <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                        {item.group}
                      </p>
                    )}
                    <button
                      type="button"
                      data-index={i}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => select(item)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-accent",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.subtitle && (
                        <span className="shrink-0 truncate text-xs text-muted-foreground">
                          {item.subtitle}
                        </span>
                      )}
                    </button>
                  </React.Fragment>
                );
              })
            )}
          </div>

          <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <ArrowUp className="h-3 w-3" />
              <ArrowDown className="h-3 w-3" /> to navigate
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" /> to select
            </span>
            <span className="ml-auto">esc to close</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
