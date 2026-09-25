import * as React from "react";
import { ChevronDown, ChevronRight, Folder, FolderPlus, Lock, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { useConfirm, usePrompt } from "@/components/ui/confirm-provider";
import { useLayerFolderStore } from "../store/layerFolderStore";
import { useLayerMeta } from "../craft/layerMeta";
import { useEditor } from "@craftjs/core";

const FOLDER_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"];

/** Virtual layer folders — organize nodes via custom.layer.folder id. */
export const LayerFolderBar: React.FC<{
  nodeIds: string[];
  onSelectNode: (id: string) => void;
}> = ({ nodeIds, onSelectNode }) => {
  const folders = useLayerFolderStore((s) => s.folders);
  const collapsedFolderIds = useLayerFolderStore((s) => s.collapsedFolderIds);
  const createFolder = useLayerFolderStore((s) => s.createFolder);
  const renameFolder = useLayerFolderStore((s) => s.renameFolder);
  const deleteFolder = useLayerFolderStore((s) => s.deleteFolder);
  const toggleFolderCollapsed = useLayerFolderStore((s) => s.toggleFolderCollapsed);
  const setFolderHidden = useLayerFolderStore((s) => s.setFolderHidden);
  const setFolderLocked = useLayerFolderStore((s) => s.setFolderLocked);
  const setFolderColor = useLayerFolderStore((s) => s.setFolderColor);
  const { setFolder, setLocked } = useLayerMeta();
  const { query, actions } = useEditor();
  const confirm = useConfirm();
  const prompt = usePrompt();

  const assignments = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const id of nodeIds) {
      try {
        const custom = query.node(id).get().data.custom;
        const folderId = (custom as { layer?: { folder?: string } })?.layer?.folder;
        if (!folderId) continue;
        const list = map.get(folderId) ?? [];
        list.push(id);
        map.set(folderId, list);
      } catch {
        /* skip */
      }
    }
    return map;
  }, [nodeIds, query]);

  const onNewFolder = (): void => {
    void (async () => {
      const name = await prompt({
        title: "Folder name",
        placeholder: "e.g. Hero sections",
        confirmLabel: "Create",
      });
      if (!name?.trim()) return;
      createFolder(name);
    })();
  };

  const onDropNode = (folderId: string, nodeId: string): void => {
    setFolder(nodeId, folderId);
  };

  if (folders.length === 0) {
    return (
      <div className="border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={onNewFolder}
          className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-border py-1.5 text-[10px] text-muted-foreground hover:bg-muted"
        >
          <FolderPlus className="h-3 w-3" /> Create folder
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-border px-2 py-2">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-[10px] font-medium uppercase text-muted-foreground">Folders</span>
        <button type="button" onClick={onNewFolder} title="New folder" aria-label="New folder">
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
      </div>
      <ul className="space-y-0.5">
        {folders.map((f) => {
          const collapsed = collapsedFolderIds.includes(f.id);
          const members = assignments.get(f.id) ?? [];
          return (
            <li key={f.id}>
              <div
                className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const nodeId = e.dataTransfer.getData("text/plain");
                  if (nodeId) onDropNode(f.id, nodeId);
                }}
              >
                <button type="button" onClick={() => toggleFolderCollapsed(f.id)} aria-label={collapsed ? "Expand folder" : "Collapse folder"}>
                  {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                <button
                  type="button"
                  className="h-2.5 w-2.5 shrink-0 rounded-full border"
                  style={{ background: f.color ?? "transparent" }}
                  onClick={() => {
                    const idx = f.color ? FOLDER_COLORS.indexOf(f.color) + 1 : 0;
                    setFolderColor(f.id, FOLDER_COLORS[idx % FOLDER_COLORS.length] ?? null);
                  }}
                  aria-label="Cycle folder color"
                />
                <Folder className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span
                  className="min-w-0 flex-1 truncate text-[11px]"
                  onDoubleClick={() => {
                    void (async () => {
                      const name = await prompt({
                        title: "Rename folder",
                        defaultValue: f.name,
                        confirmLabel: "Rename",
                      });
                      if (name?.trim()) renameFolder(f.id, name.trim());
                    })();
                  }}
                >
                  {f.name}
                  <span className="ml-1 text-muted-foreground">({members.length})</span>
                </span>
                <button type="button" title="Hide all in folder" onClick={() => {
                  setFolderHidden(f.id, !f.hidden);
                  for (const id of members) actions.setHidden(id, !f.hidden);
                }}>
                  <EyeOff className="h-3 w-3" />
                </button>
                <button type="button" title="Lock all in folder" onClick={() => {
                  const next = !f.locked;
                  setFolderLocked(f.id, next);
                  for (const id of members) setLocked(id, next);
                }}>
                  <Lock className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  className="text-[9px] text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    void (async () => {
                      const ok = await confirm({
                        title: `Delete folder "${f.name}"?`,
                        description: "Layers on the canvas will stay; only the folder is removed.",
                        confirmLabel: "Delete",
                        destructive: true,
                      });
                      if (ok) deleteFolder(f.id);
                    })();
                  }}
                >
                  ×
                </button>
              </div>
              {!collapsed && members.length > 0 && (
                <ul className="ml-5 border-l border-border pl-2">
                  {members.map((id) => (
                    <li key={id}>
                      <button
                        type="button"
                        className={cn("w-full truncate py-0.5 text-left text-[10px] hover:text-primary")}
                        onClick={() => onSelectNode(id)}
                      >
                        {query.node(id).get().data.displayName ?? id.slice(0, 8)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
