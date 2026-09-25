import * as React from "react";
import {
  Search,
  ImageIcon,
  Film,
  Plus,
  X,
  LayoutGrid,
  List,
  Star,
  Trash2,
  FolderInput,
  Info,
} from "lucide-react";
import { Input, Button } from "@/components/ui";
import { toast } from "@/components/ui/toaster";
import { useConfirm } from "@/components/ui/confirm-provider";
import { useSiteStore } from "@/store/siteStore";
import {
  useMediaList,
  useMoveMedia,
  useDeleteMedia,
  useUpdateMedia,
  useMediaUsage,
} from "@/views/media/hooks/useMedia";
import { UploadButton } from "@/views/media/components/UploadButton";
import { FolderTree, type FolderSelection } from "@/views/media/components/FolderTree";
import type { MediaItem } from "@/views/media/types";
import { cn } from "@/lib/cn";
import { useAssetPickStore } from "../store/assetPickStore";
import { useAssetInsert } from "../hooks/useAssetInsert";

type AssetKind = "images" | "videos";
type ViewMode = "grid" | "list";
type SortKey = "recent" | "name" | "size";

const matchesKind = (item: MediaItem, kind: AssetKind): boolean =>
  kind === "images" ? item.type.startsWith("image/") : item.type.startsWith("video/");

const fmtSize = (n?: number | null): string => {
  if (!n) return "—";
  if (n > 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n > 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
};

/**
 * Builder asset browser — folders, search, bulk ops, details panel.
 */
export const AssetManagerPanel: React.FC = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const confirm = useConfirm();
  const [kind, setKind] = React.useState<AssetKind>("images");
  const [q, setQ] = React.useState("");
  const [folder, setFolder] = React.useState<FolderSelection>("all");
  const [view, setView] = React.useState<ViewMode>("grid");
  const [sort, setSort] = React.useState<SortKey>("recent");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [favorites, setFavorites] = React.useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("ob-asset-favorites");
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  const pickActive = useAssetPickStore((s) => s.pending !== null);
  const pickFilter = useAssetPickStore((s) => s.filter);
  const cancelPick = useAssetPickStore((s) => s.cancel);
  const pick = useAssetPickStore((s) => s.pick);
  const moveMedia = useMoveMedia();
  const deleteMedia = useDeleteMedia();

  const listQuery = React.useMemo(() => {
    const out: { q?: string; folderId?: string } = {};
    if (q) out.q = q;
    if (folder !== "all") out.folderId = folder;
    return Object.keys(out).length ? out : folder !== "all" ? { folderId: folder } : undefined;
  }, [q, folder]);

  const { data: items = [], isLoading } = useMediaList(listQuery);

  const visible = React.useMemo(() => {
    let list = items.filter((item) => matchesKind(item, kind));
    if (pickActive) {
      if (pickFilter === "image") list = list.filter((item) => item.type.startsWith("image/"));
      else if (pickFilter === "video") list = list.filter((item) => item.type.startsWith("video/"));
    }
    if (sort === "name") list = [...list].sort((a, b) => (a.alt ?? a.storageKey).localeCompare(b.alt ?? b.storageKey));
    if (sort === "size") list = [...list].sort((a, b) => (b.size ?? 0) - (a.size ?? 0));
    return list;
  }, [items, kind, sort, pickActive, pickFilter]);

  const toggleFav = (id: string): void => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("ob-asset-favorites", JSON.stringify([...next]));
      return next;
    });
  };

  const toggleSelect = (id: string, multi: boolean): void => {
    setSelected((prev) => {
      const next = new Set(multi ? prev : []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onDropAsset = (folderId: string | null, mediaId: string): void => {
    moveMedia.mutate(
      { mediaIds: [mediaId], folderId },
      {
        onSuccess: () => toast.success("Asset moved"),
        onError: () => toast.error("Could not move asset"),
      },
    );
  };

  const bulkDelete = (): void => {
    if (selected.size === 0) return;
    void (async () => {
      const ok = await confirm({
        title: `Delete ${selected.size} asset(s)?`,
        description: "Deleted assets are removed from the media library.",
        confirmLabel: "Delete",
        destructive: true,
      });
      if (!ok) return;
      const results = await Promise.allSettled(
        [...selected].map((id) => deleteMedia.mutateAsync(id)),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      setSelected(new Set());
      if (failed > 0) {
        toast.error(`${failed} asset(s) could not be deleted`);
      } else {
        toast.success("Deleted selected assets");
      }
    })();
  };

  const bulkMove = (folderId: string | null): void => {
    if (selected.size === 0) return;
    moveMedia.mutate(
      { mediaIds: [...selected], folderId },
      {
        onSuccess: () => {
          toast.success("Moved selected assets");
          setSelected(new Set());
        },
        onError: () => toast.error("Bulk move failed"),
      },
    );
  };

  if (!siteId) {
    return (
      <p className="p-4 text-center text-xs text-muted-foreground">
        Select a site to browse assets.
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      {pickActive && (
        <div className="flex items-start gap-2 rounded-md border border-primary/40 bg-primary/5 px-2.5 py-2 text-[11px]">
          <p className="flex-1 leading-snug">Click an asset to use it in the selected field.</p>
          <button type="button" onClick={cancelPick} aria-label="Cancel pick">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <FolderTree selected={folder} onSelect={setFolder} onDropAsset={onDropAsset} />

      <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
        {(["images", "videos"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cn(
              "flex items-center justify-center gap-1 rounded px-2 py-1.5 text-xs font-medium",
              kind === k ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {k === "images" ? <ImageIcon className="h-3.5 w-3.5" /> : <Film className="h-3.5 w-3.5" />}
            {k === "images" ? "Images" : "Videos"}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search assets…" className="h-8 pl-7 text-xs" />
        </div>
        <UploadButton accept={kind === "videos" ? "video/*" : "image/*,video/*"} variant="outline" size="sm" iconOnly className="h-8 w-8 px-0" label="Upload" />
        <button type="button" title="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")} className="flex h-8 w-8 items-center justify-center rounded border border-border">
          <LayoutGrid className="h-3.5 w-3.5" />
        </button>
        <button type="button" title="List view" aria-pressed={view === "list"} onClick={() => setView("list")} className="flex h-8 w-8 items-center justify-center rounded border border-border">
          <List className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1 text-[10px]">
        <span className="text-muted-foreground">Sort:</span>
        {(["recent", "name", "size"] as SortKey[]).map((s) => (
          <button key={s} type="button" onClick={() => setSort(s)} className={cn("rounded px-1.5 py-0.5 capitalize", sort === s ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
            {s}
          </button>
        ))}
        {selected.size > 0 && (
          <>
            <span className="ml-2 text-muted-foreground">{selected.size} selected</span>
            <button type="button" onClick={() => bulkMove(null)} className="rounded px-1.5 py-0.5 hover:bg-muted" title="Move to unfiled">
              <FolderInput className="inline h-3 w-3" /> Unfile
            </button>
            <button type="button" onClick={bulkDelete} className="rounded px-1.5 py-0.5 text-destructive hover:bg-muted">
              <Trash2 className="inline h-3 w-3" /> Delete
            </button>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 p-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">No assets in this folder.</p>
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 gap-2 p-1">
            {visible.map((item) => (
              <AssetTile
                key={item.id}
                item={item}
                pickActive={pickActive}
                onPick={pick}
                selected={selected.has(item.id)}
                favorite={favorites.has(item.id)}
                onToggleSelect={toggleSelect}
                onToggleFavorite={toggleFav}
                onShowDetail={() => setDetailId(item.id)}
              />
            ))}
          </div>
        ) : (
          <ul className="space-y-1 p-1">
            {visible.map((item) => (
              <li key={item.id} className="flex items-center gap-2 rounded border border-border px-2 py-1 text-[10px]">
                <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id, true)} aria-label="Select asset" />
                <span className="min-w-0 flex-1 truncate">{item.alt || item.storageKey.split("/").pop()}</span>
                <span className="text-muted-foreground">{fmtSize(item.size)}</span>
                <button type="button" onClick={() => setDetailId(item.id)} aria-label="Details">
                  <Info className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {detailId ? <AssetDetailsPanel id={detailId} onClose={() => setDetailId(null)} favorites={favorites} onToggleFavorite={toggleFav} /> : null}
    </div>
  );
};

const AssetTile: React.FC<{
  item: MediaItem;
  pickActive: boolean;
  onPick: (item: MediaItem) => void;
  selected: boolean;
  favorite: boolean;
  onToggleSelect: (id: string, multi: boolean) => void;
  onToggleFavorite: (id: string) => void;
  onShowDetail: () => void;
}> = ({ item, pickActive, onPick, selected, favorite, onToggleSelect, onToggleFavorite, onShowDetail }) => {
  const { attachAssetDrag, insertAsset } = useAssetInsert();
  const ready = item.status === "ready" && !!item.url;
  const isImage = item.type.startsWith("image/");

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-md border bg-muted/20",
        selected ? "border-primary ring-1 ring-primary" : "border-border",
        ready && "hover:border-primary",
      )}
    >
      <div
        ref={ready && !pickActive ? attachAssetDrag(item) : undefined}
        className="relative aspect-square cursor-pointer"
        onClick={(e) => {
          if (pickActive && ready) onPick(item);
          else if (e.shiftKey) onToggleSelect(item.id, true);
          else onShowDetail();
        }}
      >
        {isImage && item.url ? (
          <img src={item.url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : item.url ? (
          <video src={item.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        ) : null}
        <div className="absolute left-1 top-1 flex gap-0.5">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect(item.id, true);
            }}
            aria-label="Select"
            className="h-3 w-3"
          />
        </div>
        <button
          type="button"
          className="absolute right-1 top-1 rounded bg-background/80 p-0.5"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(item.id);
          }}
          aria-label={favorite ? "Remove favorite" : "Add favorite"}
        >
          <Star className={cn("h-3 w-3", favorite && "fill-amber-400 text-amber-500")} />
        </button>
      </div>
      <div className="flex items-center gap-1 px-1 py-0.5">
        <span className="min-w-0 flex-1 truncate text-[9px] text-muted-foreground">{item.alt || "Untitled"}</span>
        {!pickActive && ready && (
          <button type="button" onClick={() => insertAsset(item)} aria-label="Insert">
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>
    </article>
  );
};

const AssetDetailsPanel: React.FC<{
  id: string;
  onClose: () => void;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
}> = ({ id, onClose, favorites, onToggleFavorite }) => {
  const { data: items = [] } = useMediaList();
  const item = items.find((x) => x.id === id);
  const { data: usage = [] } = useMediaUsage(id);
  const updateMedia = useUpdateMedia();
  const [alt, setAlt] = React.useState(item?.alt ?? "");

  React.useEffect(() => {
    setAlt(item?.alt ?? "");
  }, [item?.alt]);

  if (!item) return null;

  return (
    <div className="border-t border-border bg-card p-2 text-[10px]">
      <div className="mb-2 flex items-center justify-between">
        <strong>Asset details</strong>
        <button type="button" onClick={onClose} aria-label="Close details">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {item.url && item.type.startsWith("image/") ? (
        <img src={item.url} alt="" className="mb-2 max-h-24 w-full rounded object-contain bg-muted" />
      ) : null}
      <dl className="space-y-1">
        <div className="flex justify-between"><dt className="text-muted-foreground">Size</dt><dd>{fmtSize(item.size)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Dimensions</dt><dd>{item.width && item.height ? `${item.width}×${item.height}` : "—"}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Type</dt><dd>{item.type}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Used in</dt><dd>{usage.length} place(s)</dd></div>
      </dl>
      <label className="mt-2 block">
        Alt text
        <Input
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          onBlur={() => updateMedia.mutate({ id, payload: { alt } })}
          className="mt-1 h-7 text-[10px]"
        />
      </label>
      <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => onToggleFavorite(id)}>
        <Star className={cn("mr-1 h-3 w-3", favorites.has(id) && "fill-amber-400 text-amber-500")} />
        {favorites.has(id) ? "Unfavorite" : "Favorite"}
      </Button>
    </div>
  );
};
