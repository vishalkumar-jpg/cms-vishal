import * as React from "react";
import { ArrowDown, ArrowUp, CornerDownRight, Plus, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
} from "@/components/ui";
import { toast } from "@/components/ui/toaster";
import { useSiteStore } from "@/store/siteStore";
import { usePages } from "@/views/pages/hooks/usePages";
import type { PageSummary } from "@/views/pages/types";
import { useNavigation, useUpsertNavigation } from "./hooks/useNavigation";
import {
  addChild,
  MAX_DEPTH,
  moveAt,
  removeAt,
  updateAt,
  type IndexPath,
} from "./treeUtils";
import type { NavItem, NavLocation } from "./types";

const LOCATIONS: { value: NavLocation; label: string }[] = [
  { value: "header", label: "Header" },
  { value: "footer", label: "Footer" },
];

/** Mutators threaded down the recursive tree, all keyed by an index-path. */
interface TreeActions {
  update: (path: IndexPath, fn: (item: NavItem) => NavItem) => void;
  remove: (path: IndexPath) => void;
  move: (path: IndexPath, delta: -1 | 1) => void;
  addSub: (path: IndexPath) => void;
}

interface NavItemRowProps {
  item: NavItem;
  path: IndexPath;
  index: number;
  siblingCount: number;
  depth: number;
  pages: PageSummary[];
  actions: TreeActions;
}

const NavItemRow: React.FC<NavItemRowProps> = ({
  item,
  path,
  index,
  siblingCount,
  depth,
  pages,
  actions,
}) => {
  const source: "url" | "page" = item.pageId ? "page" : "url";
  // depth is 1-based; can nest sub-items while strictly below MAX_DEPTH.
  const canAddSub = depth < MAX_DEPTH;

  const setSource = (next: "url" | "page") =>
    actions.update(path, (it) =>
      next === "page"
        ? { ...it, href: undefined, pageId: it.pageId ?? "" }
        : { ...it, pageId: undefined, href: it.href ?? "" },
    );

  return (
    <Card className="border-border">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`label-${path.join("-")}`}>Label</Label>
              <Input
                id={`label-${path.join("-")}`}
                value={item.label}
                placeholder="Link label"
                onChange={(e) =>
                  actions.update(path, (it) => ({ ...it, label: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Link source</Label>
              <Select value={source} onValueChange={(v) => setSource(v as "url" | "page")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="url">Custom URL</SelectItem>
                  <SelectItem value="page">Page</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {source === "url" ? (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={`href-${path.join("-")}`}>URL</Label>
                <Input
                  id={`href-${path.join("-")}`}
                  value={item.href ?? ""}
                  placeholder="https://example.com or /about"
                  onChange={(e) =>
                    actions.update(path, (it) => ({ ...it, href: e.target.value }))
                  }
                />
              </div>
            ) : (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Page</Label>
                <Select
                  value={item.pageId ?? ""}
                  onValueChange={(v) =>
                    actions.update(path, (it) => ({ ...it, pageId: v, href: undefined }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a page" />
                  </SelectTrigger>
                  <SelectContent>
                    {pages.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch
                id={`target-${path.join("-")}`}
                checked={item.target === "_blank"}
                onCheckedChange={(checked) =>
                  actions.update(path, (it) => ({
                    ...it,
                    target: checked ? "_blank" : undefined,
                  }))
                }
              />
              <Label htmlFor={`target-${path.join("-")}`} className="cursor-pointer">
                Open in new tab
              </Label>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Move up"
              disabled={index === 0}
              onClick={() => actions.move(path, -1)}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Move down"
              disabled={index === siblingCount - 1}
              onClick={() => actions.move(path, 1)}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              aria-label="Delete"
              onClick={() => actions.remove(path)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {item.children.length > 0 && (
          <div className="space-y-3 border-l-2 border-border pl-4">
            {item.children.map((child, i) => (
              <NavItemRow
                key={i}
                item={child}
                path={[...path, i]}
                index={i}
                siblingCount={item.children.length}
                depth={depth + 1}
                pages={pages}
                actions={actions}
              />
            ))}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canAddSub}
          onClick={() => actions.addSub(path)}
        >
          <CornerDownRight className="h-4 w-4" />
          Add sub-item
        </Button>
      </CardContent>
    </Card>
  );
};

const NavTree: React.FC<{ location: NavLocation; pages: PageSummary[] }> = ({
  location,
  pages,
}) => {
  const { data: nav, isLoading } = useNavigation(location);
  const upsert = useUpsertNavigation(location);

  const [tree, setTree] = React.useState<NavItem[]>([]);
  // Reseed local state whenever the fetched nav for this location changes.
  const seededFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (isLoading) return;
    const stamp = nav ? nav.updatedAt : "empty";
    if (seededFor.current === stamp) return;
    seededFor.current = stamp;
    setTree(nav?.tree ?? []);
  }, [nav, isLoading]);

  const actions = React.useMemo<TreeActions>(
    () => ({
      update: (path, fn) => setTree((t) => updateAt(t, path, fn)),
      remove: (path) => setTree((t) => removeAt(t, path)),
      move: (path, delta) => setTree((t) => moveAt(t, path, delta)),
      addSub: (path) => setTree((t) => addChild(t, path)),
    }),
    [],
  );

  const onSave = () => {
    upsert.mutate(
      { tree },
      {
        onSuccess: () => toast.success("Navigation saved"),
        onError: () => toast.error("Failed to save navigation"),
      },
    );
  };

  if (isLoading) {
    return <p className="py-8 text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      {tree.length === 0 ? (
        <p className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No links yet. Add your first link below.
        </p>
      ) : (
        <div className="space-y-3">
          {tree.map((item, i) => (
            <NavItemRow
              key={i}
              item={item}
              path={[i]}
              index={i}
              siblingCount={tree.length}
              depth={1}
              pages={pages}
              actions={actions}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => setTree((t) => addChild(t, []))}
        >
          <Plus className="h-4 w-4" />
          Add link
        </Button>
        <Button type="button" onClick={onSave} disabled={upsert.isPending}>
          {upsert.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
};

export const NavigationEditor: React.FC = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const { data: pages = [] } = usePages(siteId);

  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Navigation</h1>
        <p className="text-sm text-muted-foreground">
          Build the menus shown across your site. Drag-free reorder, nest up to{" "}
          {MAX_DEPTH} levels deep, and link to pages or custom URLs.
        </p>
      </header>

      {!siteId ? (
        <p className="rounded-md border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          Select a site to edit its navigation.
        </p>
      ) : (
        <Tabs defaultValue="header">
          <TabsList>
            {LOCATIONS.map((loc) => (
              <TabsTrigger key={loc.value} value={loc.value}>
                {loc.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {LOCATIONS.map((loc) => (
            <TabsContent key={loc.value} value={loc.value} className={cn("mt-6")}>
              <NavTree location={loc.value} pages={pages} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
};
