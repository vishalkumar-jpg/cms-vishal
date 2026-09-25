import * as React from "react";
import { Search, Download } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { toast } from "@/components/ui/toaster";
import { useSiteStore } from "@/store/siteStore";
import { useMediaList, useMoveMedia, mediaExportUrl } from "./hooks/useMedia";
import { MediaGrid } from "./components/MediaGrid";
import { UploadButton } from "./components/UploadButton";
import { FolderTree, type FolderSelection } from "./components/FolderTree";
import { MediaDetailDialog } from "./components/MediaDetailDialog";
import type { MediaItem } from "./types";

export const MediaLibrary: React.FC = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const [q, setQ] = React.useState("");
  const [folder, setFolder] = React.useState<FolderSelection>("all");
  const [editing, setEditing] = React.useState<MediaItem | null>(null);
  const move = useMoveMedia();

  const query = React.useMemo(() => {
    const out: { q?: string; folderId?: string } = {};
    if (q) out.q = q;
    if (folder !== "all") out.folderId = folder; // "root" or a folder id
    return Object.keys(out).length ? out : undefined;
  }, [q, folder]);

  const { data: items = [], isLoading } = useMediaList(query);

  const onDropAsset = (folderId: string | null, mediaId: string): void => {
    move.mutate(
      { mediaIds: [mediaId], folderId },
      {
        onSuccess: () => toast.success("Moved"),
        onError: () => toast.error("Move failed"),
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Media library</h1>
          <p className="text-sm text-muted-foreground">Images, video and documents for this site.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href={mediaExportUrl()} target="_blank" rel="noreferrer">
              <Download className="mr-1.5 h-4 w-4" /> Export CSV
            </a>
          </Button>
          <UploadButton accept="image/*,video/*,application/pdf" />
        </div>
      </div>

      {!siteId ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Select a site to view its media.
        </p>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row">
          <FolderTree selected={folder} onSelect={setFolder} onDropAsset={onDropAsset} />

          <div className="min-w-0 flex-1">
            <div className="relative mb-4 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by alt text…"
                className="pl-9"
              />
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Tip: drag a tile onto a folder to move it.
            </p>
            <MediaGrid
              items={items}
              isLoading={isLoading}
              onItemClick={setEditing}
              draggable
              emptyText="No media here. Upload an asset or pick another folder."
            />
          </div>
        </div>
      )}

      <MediaDetailDialog item={editing} onClose={() => setEditing(null)} />
    </div>
  );
};
