import * as React from "react";
import { Folder, FolderPlus, Images, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toaster";
import { useConfirm, usePrompt } from "@/components/ui/confirm-provider";
import { cn } from "@/lib/cn";
import {
  useCreateFolder,
  useDeleteFolder,
  useMediaFolders,
  useUpdateFolder,
} from "../hooks/useMedia";
import type { MediaFolder } from "../types";

/** Special selection sentinels alongside a real folder id. */
export type FolderSelection = "all" | "root" | string;

interface TreeNode extends MediaFolder {
  children: TreeNode[];
}

function buildTree(folders: MediaFolder[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  for (const f of folders) byId.set(f.id, { ...f, children: [] });
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId)!.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/**
 * Folder tree + filter for the media library. Selecting a node filters the grid;
 * "all" shows everything, "root" shows unfiled assets. Supports create/rename/
 * delete and accepts asset drops (drag a media tile onto a folder to move it).
 */
export const FolderTree: React.FC<{
  selected: FolderSelection;
  onSelect: (sel: FolderSelection) => void;
  onDropAsset?: (folderId: string | null, mediaId: string) => void;
}> = ({ selected, onSelect, onDropAsset }) => {
  const { data: folders = [] } = useMediaFolders();
  const createFolder = useCreateFolder();
  const prompt = usePrompt();
  const tree = React.useMemo(() => buildTree(folders), [folders]);

  const onNewRoot = (): void => {
    void (async () => {
      const name = await prompt({
        title: "New folder name",
        placeholder: "e.g. Campaign assets",
        confirmLabel: "Create",
      });
      if (!name?.trim()) return;
      createFolder.mutate(
        { name: name.trim() },
        {
          onSuccess: () => toast.success("Folder created"),
          onError: () => toast.error("Could not create folder"),
        },
      );
    })();
  };

  return (
    <nav className="w-full shrink-0 border-b border-border pb-3 text-sm sm:w-56 sm:border-b-0 sm:border-r sm:pr-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase text-muted-foreground">Folders</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNewRoot} title="New folder">
          <FolderPlus className="h-4 w-4" />
        </Button>
      </div>

      <button
        type="button"
        onClick={() => onSelect("all")}
        className={cn(
          "mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted",
          selected === "all" && "bg-muted font-medium",
        )}
      >
        <Images className="h-4 w-4" /> All media
      </button>
      <FolderRow
        node={null}
        depth={0}
        selected={selected}
        onSelect={onSelect}
        onDropAsset={onDropAsset}
      />

      {tree.map((node) => (
        <FolderRow
          key={node.id}
          node={node}
          depth={0}
          selected={selected}
          onSelect={onSelect}
          onDropAsset={onDropAsset}
        />
      ))}
    </nav>
  );
};

/** A single folder row (or the "Unfiled" root pseudo-row when node is null). */
const FolderRow: React.FC<{
  node: TreeNode | null;
  depth: number;
  selected: FolderSelection;
  onSelect: (sel: FolderSelection) => void;
  onDropAsset?: (folderId: string | null, mediaId: string) => void;
}> = ({ node, depth, selected, onSelect, onDropAsset }) => {
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [over, setOver] = React.useState(false);
  const isUnfiled = node === null;
  const id: FolderSelection = isUnfiled ? "root" : node.id;
  const folderIdForDrop = isUnfiled ? null : node.id;

  const onRename = (): void => {
    if (!node) return;
    void (async () => {
      const name = await prompt({
        title: "Rename folder",
        defaultValue: node.name,
        confirmLabel: "Rename",
      });
      if (!name?.trim() || name.trim() === node.name) return;
      updateFolder.mutate(
        { id: node.id, payload: { name: name.trim() } },
        { onError: () => toast.error("Rename failed") },
      );
    })();
  };

  const onDelete = (): void => {
    if (!node) return;
    void (async () => {
      const ok = await confirm({
        title: `Delete "${node.name}"?`,
        description: "Assets in this folder will move to the root.",
        confirmLabel: "Delete",
        destructive: true,
      });
      if (!ok) return;
      deleteFolder.mutate(node.id, {
        onSuccess: () => toast.success("Folder deleted"),
        onError: () => toast.error("Delete failed"),
      });
    })();
  };

  return (
    <>
      <div
        onDragOver={(e) => {
          if (onDropAsset) {
            e.preventDefault();
            setOver(true);
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          setOver(false);
          const mediaId = e.dataTransfer.getData("text/media-id");
          if (mediaId && onDropAsset) onDropAsset(folderIdForDrop, mediaId);
        }}
        className={cn(
          "group flex items-center gap-1 rounded-md pr-1 hover:bg-muted",
          selected === id && "bg-muted",
          over && "ring-2 ring-primary",
        )}
        style={{ paddingLeft: depth * 12 }}
      >
        <button
          type="button"
          onClick={() => onSelect(id)}
          className={cn(
            "flex flex-1 items-center gap-2 px-2 py-1.5 text-left",
            selected === id && "font-medium",
          )}
        >
          <Folder className="h-4 w-4 text-muted-foreground" />
          {isUnfiled ? "Unfiled" : node.name}
        </button>
        {!isUnfiled && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100"
                title="Folder actions"
              >
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onRename}>
                <Pencil className="mr-2 h-4 w-4" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {node?.children.map((child) => (
        <FolderRow
          key={child.id}
          node={child}
          depth={depth + 1}
          selected={selected}
          onSelect={onSelect}
          onDropAsset={onDropAsset}
        />
      ))}
    </>
  );
};
