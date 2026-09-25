import * as React from "react";
import { useNavigate } from "react-router";
import { Database, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { useConfirm } from "@/components/ui/confirm-provider";
import { DELETE_CONFIRM_LABEL } from "@/components/ui/confirm-labels";
import { useSiteStore } from "@/store/siteStore";
import { useCollections, useCreateCollection, useDeleteCollection } from "./hooks/useCollections";
import { slugify } from "./slug";
import type { Collection } from "./types";

/**
 * Collections manager — lists this site's dynamic content types. Create a
 * collection here, then click it to define its field schema and manage items.
 */
export const Collections: React.FC = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const navigate = useNavigate();
  const { data: collections = [], isLoading, isError } = useCollections();
  const create = useCreateCollection();
  const del = useDeleteCollection();
  const confirm = useConfirm();
  const [createOpen, setCreateOpen] = React.useState(false);

  const doDelete = (collection: Collection): void => {
    void (async () => {
      const ok = await confirm({
        title: `Delete "${collection.name}"?`,
        description: "This collection and all of its items will be permanently removed.",
        confirmLabel: DELETE_CONFIRM_LABEL,
        destructive: true,
      });
      if (!ok) return;
      del.mutate(collection.id, {
        onSuccess: () => toast.success("Collection deleted"),
        onError: () => toast.error("Delete failed"),
      });
    })();
  };

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Collections</h1>
          <p className="text-sm text-muted-foreground">
            Define custom content types (Case Studies, Team, Products…) and manage
            their items. Render them on pages with the Collection List block.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={!siteId}>
          <Plus className="mr-1.5 h-4 w-4" /> New collection
        </Button>
      </div>

      <div className="-mx-4 overflow-x-auto rounded-lg border border-border px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Fields</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!siteId && <EmptyRow text="Select a site to view its collections." />}
            {siteId && isLoading && <EmptyRow text="Loading collections…" />}
            {siteId && isError && <EmptyRow text="Could not load collections." />}
            {siteId && !isLoading && !isError && collections.length === 0 && (
              <EmptyRow text="No collections yet. Create one to get started." />
            )}
            {collections.map((c) => (
              <Row
                key={c.id}
                collection={c}
                onOpen={() => navigate(`/collections/${c.id}`)}
                onDelete={() => doDelete(c)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <CreateCollectionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={(name, slug) =>
          create.mutate(
            { name, slug, fields: [] },
            {
              onSuccess: (c) => {
                toast.success("Collection created");
                setCreateOpen(false);
                navigate(`/collections/${c.id}`);
              },
              onError: () => toast.error("Create failed (name/slug may be taken)"),
            },
          )
        }
        pending={create.isPending}
      />
    </div>
  );
};

const Row: React.FC<{ collection: Collection; onOpen: () => void; onDelete: () => void }> = ({
  collection,
  onOpen,
  onDelete,
}) => (
  <tr className="hover:bg-muted/30">
    <td className="px-4 py-3">
      <button type="button" onClick={onOpen} className="flex items-center gap-2 font-medium hover:underline">
        <Database className="h-4 w-4 text-muted-foreground" />
        {collection.name}
      </button>
    </td>
    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{collection.slug}</td>
    <td className="px-4 py-3 text-muted-foreground">{collection.fields.length}</td>
    <td className="px-4 py-3">
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" onClick={onOpen} title="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-destructive" onClick={onDelete} title="Delete">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </td>
  </tr>
);

const EmptyRow: React.FC<{ text: string }> = ({ text }) => (
  <tr>
    <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
      {text}
    </td>
  </tr>
);

const CreateCollectionDialog: React.FC<{
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (name: string, slug: string) => void;
  pending: boolean;
}> = ({ open, onOpenChange, onCreate, pending }) => {
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugDirty, setSlugDirty] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setName("");
      setSlug("");
      setSlugDirty(false);
    }
  }, [open]);

  const onName = (v: string): void => {
    setName(v);
    if (!slugDirty) setSlug(slugify(v));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New collection</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="col-name">Name</Label>
            <Input id="col-name" value={name} onChange={(e) => onName(e.target.value)} placeholder="Case Studies" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="col-slug">Slug</Label>
            <Input
              id="col-slug"
              value={slug}
              onChange={(e) => {
                setSlugDirty(true);
                setSlug(slugify(e.target.value));
              }}
              placeholder="case-studies"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || !slug.trim() || pending} onClick={() => onCreate(name.trim(), slug.trim())}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
