import * as React from "react";
import { CheckCircle2, Circle, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { useConfirm } from "@/components/ui/confirm-provider";
import {
  DELETE_CANNOT_UNDO_DESCRIPTION,
  DELETE_CONFIRM_LABEL,
  PUBLISH_CONFIRM_LABEL,
} from "@/components/ui/confirm-labels";
import {
  COLLECTION_ITEM_PUBLISH_CONFIRM_DESCRIPTION,
  COLLECTION_ITEM_UNPUBLISH_CONFIRM_DESCRIPTION,
  COLLECTION_ITEM_UNPUBLISH_CONFIRM_LABEL,
} from "../constants";
import { useMediaPicker } from "@/views/media/components/MediaPickerProvider";
import {
  useCreateItem,
  useDeleteItem,
  useItems,
  usePublishItem,
  useUnpublishItem,
  useUpdateItem,
} from "../hooks/useCollections";
import { slugify } from "../slug";
import type { Collection, CollectionField, CollectionItem } from "../types";

/**
 * Per-collection item manager. Lists items in a table (first few field columns),
 * and create/edit them with a form generated from the collection's field schema.
 * Items have a draft/published lifecycle.
 */
export const ItemsManager: React.FC<{ collection: Collection }> = ({ collection }) => {
  const { data, isLoading } = useItems(collection.id, { pageSize: 100 });
  const del = useDeleteItem(collection.id);
  const publish = usePublishItem(collection.id);
  const unpublish = useUnpublishItem(collection.id);
  const confirm = useConfirm();
  const [editing, setEditing] = React.useState<CollectionItem | null>(null);
  const [creating, setCreating] = React.useState(false);

  const items = data?.items ?? [];
  // Show up to the first 3 fields as table columns.
  const cols = collection.fields.slice(0, 3);

  const doPublish = (item: CollectionItem): void => {
    void (async () => {
      const ok = await confirm({
        title: `Publish "${item.slug}"?`,
        description: COLLECTION_ITEM_PUBLISH_CONFIRM_DESCRIPTION,
        confirmLabel: PUBLISH_CONFIRM_LABEL,
      });
      if (!ok) return;
      publish.mutate(item.id, {
        onSuccess: () => toast.success("Published"),
        onError: () => toast.error("Publish failed"),
      });
    })();
  };

  const doUnpublish = (item: CollectionItem): void => {
    void (async () => {
      const ok = await confirm({
        title: `Unpublish "${item.slug}"?`,
        description: COLLECTION_ITEM_UNPUBLISH_CONFIRM_DESCRIPTION,
        confirmLabel: COLLECTION_ITEM_UNPUBLISH_CONFIRM_LABEL,
      });
      if (!ok) return;
      unpublish.mutate(item.id, {
        onSuccess: () => toast.success("Reverted to draft"),
        onError: () => toast.error("Failed"),
      });
    })();
  };

  const doDelete = (item: CollectionItem): void => {
    void (async () => {
      const ok = await confirm({
        title: `Delete "${item.slug}"?`,
        description: DELETE_CANNOT_UNDO_DESCRIPTION,
        confirmLabel: DELETE_CONFIRM_LABEL,
        destructive: true,
      });
      if (!ok) return;
      del.mutate(item.id, {
        onSuccess: () => toast.success("Item deleted"),
        onError: () => toast.error("Delete failed"),
      });
    })();
  };

  if (collection.fields.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Define some fields first (Fields tab) before adding items.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New item
        </Button>
      </div>

      <div className="-mx-4 overflow-x-auto rounded-lg border border-border px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Slug</th>
              {cols.map((f) => (
                <th key={f.key} className="px-4 py-3 font-medium">
                  {f.label}
                </th>
              ))}
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr>
                <td colSpan={cols.length + 3} className="px-4 py-8 text-center text-muted-foreground">
                  Loading items…
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={cols.length + 3} className="px-4 py-8 text-center text-muted-foreground">
                  No items yet.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.slug}</td>
                {cols.map((f) => (
                  <td key={f.key} className="px-4 py-3">
                    <CellValue field={f} value={item.data[f.key]} />
                  </td>
                ))}
                <td className="px-4 py-3">
                  <Badge variant={item.status === "published" ? "default" : "secondary"}>{item.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {item.status === "published" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Unpublish"
                        onClick={() => doUnpublish(item)}
                      >
                        <Circle className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Publish"
                        onClick={() => doPublish(item)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" title="Edit" onClick={() => setEditing(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      title="Delete"
                      onClick={() => doDelete(item)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <ItemEditorDialog
          collection={collection}
          item={editing}
          open
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
};

const CellValue: React.FC<{ field: CollectionField; value: unknown }> = ({ field, value }) => {
  if (value === undefined || value === null || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (field.type === "image") {
    return <img src={String(value)} alt="" className="h-8 w-12 rounded object-cover" />;
  }
  if (field.type === "boolean") return <span>{value ? "Yes" : "No"}</span>;
  const text = String(value);
  return <span>{text.length > 60 ? `${text.slice(0, 60)}…` : text}</span>;
};

const ItemEditorDialog: React.FC<{
  collection: Collection;
  item: CollectionItem | null;
  open: boolean;
  onClose: () => void;
}> = ({ collection, item, open, onClose }) => {
  const create = useCreateItem(collection.id);
  const update = useUpdateItem(collection.id);
  const [slug, setSlug] = React.useState(item?.slug ?? "");
  const [slugDirty, setSlugDirty] = React.useState(!!item);
  const [data, setData] = React.useState<Record<string, unknown>>(item?.data ?? {});

  const setVal = (key: string, v: unknown): void => setData((d) => ({ ...d, [key]: v }));

  const titleField = collection.fields.find((f) => f.key === "title" || f.key === "name");
  React.useEffect(() => {
    if (slugDirty || item) return;
    const t = titleField ? data[titleField.key] : undefined;
    if (typeof t === "string" && t) setSlug(slugify(t));
  }, [data, slugDirty, item, titleField]);

  const pending = create.isPending || update.isPending;

  const submit = (): void => {
    const payload = { slug: slug.trim(), data };
    if (item) {
      update.mutate(
        { itemId: item.id, payload },
        {
          onSuccess: () => {
            toast.success("Item saved");
            onClose();
          },
          onError: () => toast.error("Save failed (slug may be taken)"),
        },
      );
    } else {
      create.mutate(payload, {
        onSuccess: () => {
          toast.success("Item created");
          onClose();
        },
        onError: () => toast.error("Create failed (slug may be taken)"),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : "New item"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="item-slug">Slug</Label>
            <Input
              id="item-slug"
              value={slug}
              onChange={(e) => {
                setSlugDirty(true);
                setSlug(slugify(e.target.value));
              }}
              placeholder="my-item"
              className="font-mono text-xs"
            />
          </div>
          {collection.fields.map((field) => (
            <ItemFieldInput
              key={field.key}
              field={field}
              value={data[field.key]}
              onChange={(v) => setVal(field.key, v)}
            />
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!slug.trim() || pending} onClick={submit}>
            {item ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ItemFieldInput: React.FC<{
  field: CollectionField;
  value: unknown;
  onChange: (v: unknown) => void;
}> = ({ field, value, onChange }) => {
  const openPicker = useMediaPicker();

  if (field.type === "boolean") {
    return (
      <div className="flex items-center justify-between">
        <Label>{field.label}</Label>
        <Switch checked={!!value} onCheckedChange={(c) => onChange(c)} />
      </div>
    );
  }

  if (field.type === "richtext") {
    return (
      <div className="flex flex-col gap-1">
        <Label>{field.label}</Label>
        <Textarea
          rows={5}
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Supports basic HTML (sanitized on render)"
        />
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div className="flex flex-col gap-1">
        <Label>{field.label}</Label>
        <Input
          type="number"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      </div>
    );
  }

  if (field.type === "date") {
    return (
      <div className="flex flex-col gap-1">
        <Label>{field.label}</Label>
        <Input
          type="date"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (field.type === "image") {
    const url = value ? String(value) : "";
    return (
      <div className="flex flex-col gap-1">
        <Label>{field.label}</Label>
        {url ? (
          <div className="relative h-24 overflow-hidden rounded-md border border-border">
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white hover:bg-black/80"
              title="Remove"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : null}
        <div className="flex gap-1">
          <Input value={url} onChange={(e) => onChange(e.target.value)} placeholder="Image URL" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Browse media"
            onClick={async () => {
              const picked = await openPicker();
              if (picked?.url) onChange(picked.url);
            }}
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // text / reference
  return (
    <div className="flex flex-col gap-1">
      <Label>{field.label}</Label>
      <Input
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.type === "reference" ? "Item slug or URL" : undefined}
      />
    </div>
  );
};
