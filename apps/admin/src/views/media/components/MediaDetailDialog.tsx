import * as React from "react";
import { Crop as CropIcon, FileText, Link2, Trash2 } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { useConfirm } from "@/components/ui/confirm-provider";
import { DELETE_CONFIRM_LABEL } from "@/components/ui/confirm-labels";
import {
  useCropMedia,
  useDeleteMedia,
  useMediaUsage,
  useUpdateMedia,
} from "../hooks/useMedia";
import type { CropRect, FocalPoint, MediaItem } from "../types";

/**
 * Media detail dialog: metadata (alt/tags), a focal-point + crop editor (drag a
 * dot for the focal point, drag a box for the crop), the generated responsive
 * variants, and a "Used in" panel (where-used scan).
 */
export const MediaDetailDialog: React.FC<{ item: MediaItem | null; onClose: () => void }> = ({
  item,
  onClose,
}) => {
  const confirm = useConfirm();
  const update = useUpdateMedia();
  const del = useDeleteMedia();
  const [alt, setAlt] = React.useState("");
  const [tags, setTags] = React.useState("");

  React.useEffect(() => {
    setAlt(item?.alt ?? "");
    setTags((item?.tags ?? []).join(", "));
  }, [item]);

  if (!item) return null;
  const isImage = item.type.startsWith("image/");

  const onSave = (): void => {
    update.mutate(
      {
        id: item.id,
        payload: {
          alt,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        },
      },
      {
        onSuccess: () => {
          toast.success("Media updated");
          onClose();
        },
        onError: () => toast.error("Update failed"),
      },
    );
  };

  const onDelete = (): void => {
    void (async () => {
      const label = item.alt || item.storageKey.split("/").pop() || "this asset";
      const ok = await confirm({
        title: `Delete "${label}"?`,
        description: "Deleted assets are removed from the media library.",
        confirmLabel: DELETE_CONFIRM_LABEL,
        destructive: true,
      });
      if (!ok) return;
      del.mutate(item.id, {
        onSuccess: () => {
          toast.success("Media deleted");
          onClose();
        },
        onError: () => toast.error("Delete failed"),
      });
    })();
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate">{item.alt || item.storageKey.split("/").pop()}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            {isImage && <TabsTrigger value="edit">Edit image</TabsTrigger>}
            <TabsTrigger value="usage">Used in</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-3 pt-3">
            {isImage && item.url ? (
              <img
                src={item.url}
                alt={item.alt ?? ""}
                className="max-h-56 w-full rounded-lg border border-border object-contain"
              />
            ) : (
              <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-muted/30">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="media-alt">Alt text</Label>
              <Input id="media-alt" value={alt} onChange={(e) => setAlt(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="media-tags">Tags (comma-separated)</Label>
              <Textarea id="media-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
            {(item.width || item.variants.length > 0) && (
              <div className="text-xs text-muted-foreground">
                {item.width && item.height ? `${item.width}×${item.height}px · ` : ""}
                {item.variants.length} responsive variant{item.variants.length === 1 ? "" : "s"}
                {item.variants.length > 0 && (
                  <span> ({item.variants.map((v) => `${v.width}w ${v.format}`).join(", ")})</span>
                )}
              </div>
            )}
          </TabsContent>

          {isImage && (
            <TabsContent value="edit" className="pt-3">
              <ImageEditor item={item} />
            </TabsContent>
          )}

          <TabsContent value="usage" className="pt-3">
            <UsagePanel mediaId={item.id} />
          </TabsContent>
        </Tabs>

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" className="text-destructive" onClick={onDelete}>
            <Trash2 className="mr-1.5 h-4 w-4" /> Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={onSave} disabled={update.isPending}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Focal-point + crop editor. Click to set the focal point (saved as {x,y} in
 * 0–1); drag to draw a crop box (sent as pixels relative to the intrinsic image).
 */
const ImageEditor: React.FC<{ item: MediaItem }> = ({ item }) => {
  const update = useUpdateMedia();
  const cropMedia = useCropMedia();
  const ref = React.useRef<HTMLDivElement>(null);
  const [focal, setFocal] = React.useState<FocalPoint>(item.focalPoint ?? { x: 0.5, y: 0.5 });
  const [drag, setDrag] = React.useState<{ x0: number; y0: number; x1: number; y1: number } | null>(
    null,
  );

  React.useEffect(() => setFocal(item.focalPoint ?? { x: 0.5, y: 0.5 }), [item]);

  const rel = (e: React.MouseEvent): { x: number; y: number } => {
    const box = ref.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
    };
  };

  const saveFocal = (next: FocalPoint): void => {
    setFocal(next);
    update.mutate(
      { id: item.id, payload: { focalPoint: next } },
      { onError: () => toast.error("Could not save focal point") },
    );
  };

  const applyCrop = (): void => {
    if (!drag || !item.width || !item.height) return;
    const x0 = Math.min(drag.x0, drag.x1);
    const y0 = Math.min(drag.y0, drag.y1);
    const w = Math.abs(drag.x1 - drag.x0);
    const h = Math.abs(drag.y1 - drag.y0);
    if (w < 0.02 || h < 0.02) return;
    const rect: CropRect = {
      x: Math.round(x0 * item.width),
      y: Math.round(y0 * item.height),
      w: Math.round(w * item.width),
      h: Math.round(h * item.height),
    };
    cropMedia.mutate(
      { id: item.id, rect },
      {
        onSuccess: () => {
          toast.success("Crop queued — variants will regenerate");
          setDrag(null);
        },
        onError: () => toast.error("Crop failed"),
      },
    );
  };

  if (!item.url) return <p className="text-sm text-muted-foreground">No preview available.</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Click to set the focal point. Drag to draw a crop box, then apply.
      </p>
      <div
        ref={ref}
        className="relative max-h-72 w-full cursor-crosshair select-none -mx-4 overflow-x-auto rounded-lg border border-border px-4 sm:mx-0 sm:px-0"
        onClick={(e) => {
          if (!drag) saveFocal(rel(e));
        }}
        onMouseDown={(e) => {
          const p = rel(e);
          setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
        }}
        onMouseMove={(e) => {
          if (drag && e.buttons === 1) {
            const p = rel(e);
            setDrag((d) => (d ? { ...d, x1: p.x, y1: p.y } : d));
          }
        }}
      >
        <img src={item.url} alt={item.alt ?? ""} className="pointer-events-none w-full" draggable={false} />
        {/* Focal dot */}
        <span
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow"
          style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }}
        />
        {/* Crop box */}
        {drag && (
          <span
            className="pointer-events-none absolute border-2 border-dashed border-primary bg-primary/10"
            style={{
              left: `${Math.min(drag.x0, drag.x1) * 100}%`,
              top: `${Math.min(drag.y0, drag.y1) * 100}%`,
              width: `${Math.abs(drag.x1 - drag.x0) * 100}%`,
              height: `${Math.abs(drag.y1 - drag.y0) * 100}%`,
            }}
          />
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          Focal: {focal.x.toFixed(2)}, {focal.y.toFixed(2)}
        </span>
        <div className="ml-auto flex gap-2">
          {drag && (
            <Button variant="ghost" size="sm" onClick={() => setDrag(null)}>
              Clear box
            </Button>
          )}
          <Button size="sm" onClick={applyCrop} disabled={!drag || cropMedia.isPending}>
            <CropIcon className="mr-1.5 h-4 w-4" /> Apply crop
          </Button>
        </div>
      </div>
    </div>
  );
};

/** "Used in" panel — read-only where-used scan. */
const UsagePanel: React.FC<{ mediaId: string }> = ({ mediaId }) => {
  const { data: refs = [], isLoading } = useMediaUsage(mediaId);
  if (isLoading) return <p className="py-6 text-center text-sm text-muted-foreground">Scanning…</p>;
  if (refs.length === 0)
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Not referenced by any page, post, collection item or site chrome.
      </p>
    );
  return (
    <ul className="max-h-72 space-y-1.5 overflow-auto">
      {refs.map((r) => (
        <li
          key={`${r.entityType}-${r.entityId}`}
          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
        >
          <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">{r.title}</span>
          <Badge variant="muted">{r.entityType}</Badge>
        </li>
      ))}
    </ul>
  );
};
