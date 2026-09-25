import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEditor } from "@craftjs/core";
import {
  Search,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  Blocks,
  LayoutTemplate,
  Image,
  Layers,
  Settings,
  Eye,
  Monitor,
  Smartphone,
  Save,
  Rocket,
  History,
  Sparkles,
  Stethoscope,
  Palette,
  Type,
  MousePointer2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { blockRegistry } from "@ob-cms/blocks";
import { labelFor, metaFor } from "../blocks/blockMeta";
import { iconFor } from "../blocks/blockIcons";
import { SECTION_PRESETS } from "../sections/sectionPresets";
import { useEditorUiStore, type LeftSidebarTab } from "../store/editorUiStore";
import { useBlockInsert } from "../hooks/useBlockInsert";
import { fuzzyScore } from "../utils/fuzzyMatch";
import type { Breakpoint } from "../property/styleTokens";
import { restartOnboarding } from "../onboarding/OnboardingTour";

export interface BuilderCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageTitle: string;
  onSettings: () => void;
  onHistory: () => void;
  onPreview: () => void;
  onSave: () => void;
  onPublish: () => void;
  onDiagnostics: () => void;
  onGlobalStyles: () => void;
  onOpenHelp?: () => void;
}

interface CmdItem {
  id: string;
  group: string;
  label: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
  keywords?: string[];
}

const RECENT_KEY = "ob-builder-cmd-recent";

const readRecent = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
};

const pushRecent = (id: string): void => {
  const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, 8);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
};

/**
 * Builder-scoped ⌘K palette — blocks, sections, actions, navigation.
 */
export const BuilderCommandPalette: React.FC<BuilderCommandPaletteProps> = ({
  open,
  onOpenChange,
  pageTitle,
  onSettings,
  onHistory,
  onPreview,
  onSave,
  onPublish,
  onDiagnostics,
  onGlobalStyles,
  onOpenHelp,
}) => {
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  const { actions } = useEditor();
  const { insert } = useBlockInsert();

  const setLeftTab = useEditorUiStore((s) => s.setLeftTab);
  const setBreakpoint = useEditorUiStore((s) => s.setBreakpoint);
  const toggleEditMode = useEditorUiStore((s) => s.toggleEditMode);
  const toggleHelpMode = useEditorUiStore((s) => s.toggleHelpMode);
  const setHelpCenterOpen = useEditorUiStore((s) => s.setHelpCenterOpen);
  const editMode = useEditorUiStore((s) => s.editMode);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const closeAnd = React.useCallback(
    (id: string, fn: () => void) => {
      pushRecent(id);
      onOpenChange(false);
      fn();
    },
    [onOpenChange],
  );

  const goTab = (tab: LeftSidebarTab, id: string): void =>
    closeAnd(id, () => setLeftTab(tab));

  const items = React.useMemo<CmdItem[]>(() => {
    const out: CmdItem[] = [
      {
        id: "action:save",
        group: "Actions",
        label: "Save draft",
        icon: Save,
        run: () => closeAnd("action:save", onSave),
        keywords: ["save"],
      },
      {
        id: "action:publish",
        group: "Actions",
        label: "Publish page",
        icon: Rocket,
        run: () => closeAnd("action:publish", onPublish),
        keywords: ["publish", "live"],
      },
      {
        id: "action:preview",
        group: "Actions",
        label: "Open preview",
        icon: Eye,
        run: () => closeAnd("action:preview", onPreview),
        keywords: ["preview"],
      },
      {
        id: "action:settings",
        group: "Actions",
        label: "Page settings",
        subtitle: pageTitle,
        icon: Settings,
        run: () => closeAnd("action:settings", onSettings),
        keywords: ["seo", "settings"],
      },
      {
        id: "action:history",
        group: "Actions",
        label: "Version history",
        icon: History,
        run: () => closeAnd("action:history", onHistory),
        keywords: ["undo", "versions"],
      },
      {
        id: "action:diagnostics",
        group: "Actions",
        label: "Open diagnostics",
        icon: Stethoscope,
        run: () => closeAnd("action:diagnostics", onDiagnostics),
        keywords: ["performance", "audit"],
      },
      {
        id: "action:global-styles",
        group: "Actions",
        label: "Global styles & theme",
        icon: Palette,
        run: () => closeAnd("action:global-styles", onGlobalStyles),
        keywords: ["theme", "design system", "tokens"],
      },
      {
        id: "nav:blocks",
        group: "Sidebar",
        label: "Open blocks panel",
        icon: Blocks,
        run: () => goTab("blocks", "nav:blocks"),
        keywords: ["palette"],
      },
      {
        id: "nav:sections",
        group: "Sidebar",
        label: "Open sections panel",
        icon: LayoutTemplate,
        run: () => goTab("sections", "nav:sections"),
        keywords: ["templates", "starters"],
      },
      {
        id: "nav:assets",
        group: "Sidebar",
        label: "Open assets panel",
        icon: Image,
        run: () => goTab("assets", "nav:assets"),
        keywords: ["media", "images"],
      },
      {
        id: "nav:layers",
        group: "Sidebar",
        label: "Open layers panel",
        icon: Layers,
        run: () => goTab("layers", "nav:layers"),
        keywords: ["tree"],
      },
      {
        id: "mode:structure",
        group: "View",
        label: editMode === "structure" ? "Switch to content mode" : "Switch to structure mode",
        icon: editMode === "structure" ? Type : MousePointer2,
        run: () => closeAnd("mode:structure", toggleEditMode),
        keywords: ["edit mode"],
      },
      {
        id: "view:help-center",
        group: "View",
        label: "Open help center",
        icon: Sparkles,
        run: () =>
          closeAnd("view:help-center", () => {
            if (onOpenHelp) onOpenHelp();
            else setHelpCenterOpen(true);
          }),
        keywords: ["help", "documentation", "faq"],
      },
      {
        id: "view:onboarding",
        group: "View",
        label: "Restart guided tour",
        icon: Sparkles,
        run: () => closeAnd("view:onboarding", restartOnboarding),
        keywords: ["tour", "onboarding", "intro"],
      },
      {
        id: "view:help",
        group: "View",
        label: "Toggle help mode",
        icon: Sparkles,
        run: () => closeAnd("view:help", toggleHelpMode),
        keywords: ["tooltips"],
      },
    ];

    for (const bp of ["desktop", "laptop", "tablet", "mobile", "largeDesktop"] as Breakpoint[]) {
      out.push({
        id: `bp:${bp}`,
        group: "Responsive",
        label: `Preview ${bp === "largeDesktop" ? "large desktop" : bp}`,
        icon: bp === "mobile" ? Smartphone : Monitor,
        run: () => closeAnd(`bp:${bp}`, () => setBreakpoint(bp)),
        keywords: ["breakpoint", "responsive", bp],
      });
    }

    for (const name of Object.keys(blockRegistry)) {
      if (name === "Reusable Block") continue;
      const Icon = iconFor(name);
      out.push({
        id: `block:${name}`,
        group: "Insert block",
        label: `Insert ${labelFor(name)}`,
        subtitle: name,
        icon: Icon,
        run: () => closeAnd(`block:${name}`, () => insert(name)),
        keywords: [name, ...(metaFor(name).keywords ?? []), metaFor(name).summary],
      });
    }

    for (const preset of SECTION_PRESETS) {
      out.push({
        id: `section:${preset.id}`,
        group: "Insert section",
        label: `Insert ${preset.name}`,
        subtitle: preset.group ?? preset.category,
        icon: LayoutTemplate,
        run: () => {
          closeAnd(`section:${preset.id}`, () => setLeftTab("sections"));
        },
        keywords: [preset.name, preset.category, preset.description],
      });
    }

    return out;
  }, [
    closeAnd,
    editMode,
    goTab,
    insert,
    onDiagnostics,
    onGlobalStyles,
    onOpenHelp,
    setHelpCenterOpen,
    onHistory,
    onPreview,
    onPublish,
    onSave,
    onSettings,
    pageTitle,
    setBreakpoint,
    toggleEditMode,
    toggleHelpMode,
  ]);

  const filtered = React.useMemo(() => {
    const q = query.trim();
    if (!q) {
      const recentIds = readRecent();
      const recent = recentIds
        .map((id) => items.find((i) => i.id === id))
        .filter((x): x is CmdItem => !!x);
      const rest = items.filter((i) => !recentIds.includes(i.id));
      return [...recent, ...rest];
    }
    return items
      .map((item) => ({
        item,
        score: Math.max(
          fuzzyScore(item.label, q),
          fuzzyScore(item.subtitle ?? "", q),
          ...(item.keywords ?? []).map((k) => fuzzyScore(k, q)),
        ),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.item)
      .slice(0, 40);
  }, [items, query]);

  React.useEffect(() => {
    setActive((a) => (filtered.length === 0 ? 0 : Math.min(a, filtered.length - 1)));
  }, [filtered.length]);

  const select = (item: CmdItem | undefined): void => {
    item?.run();
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (filtered.length === 0 ? 0 : (a + 1) % filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (filtered.length === 0 ? 0 : (a - 1 + filtered.length) % filtered.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(filtered[active]);
    }
  };

  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  let lastGroup = "";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm" />
        <DialogPrimitive.Content
          onKeyDown={onKeyDown}
          aria-label="Builder command palette"
          className="fixed left-1/2 top-[12%] z-[81] w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        >
          <DialogPrimitive.Title className="sr-only">Builder commands</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              placeholder="Search blocks, sections, actions…"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div ref={listRef} className="max-h-[24rem] overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches.</p>
            ) : (
              filtered.map((item, i) => {
                const showHeader = item.group !== lastGroup;
                lastGroup = item.group;
                const Icon = item.icon;
                return (
                  <React.Fragment key={item.id}>
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
                        i === active ? "bg-primary/10 text-primary" : "hover:bg-accent",
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
              <ArrowDown className="h-3 w-3" /> navigate
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" /> run
            </span>
            <span className="ml-auto">esc close</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
