import * as React from "react";
import { useNavigate } from "react-router";
import { toast } from "@/components/ui/toaster";
import { LeftSidebar } from "@/views/builder/components/LeftSidebar";
import { Canvas } from "@/views/builder/components/Canvas";
import { PropertyPanel } from "@/views/builder/property/PropertyPanel";
import { PreviewCollectionItemProvider } from "@/views/builder/components/PreviewCollectionItemProvider";
import { useEditorShortcuts } from "@/views/builder/hooks/useEditorShortcuts";
import { useEditorUiStore } from "@/views/builder/store/editorUiStore";
import { useItems } from "../hooks/useCollections";
import { useCollectionDetailAutosave } from "../hooks/useCollectionDetailAutosave";
import { CollectionDetailBuilderToolbar } from "./CollectionDetailBuilderToolbar";
import { pickPreviewItem } from "../pickPreviewItem";
import type { Collection } from "../types";

/**
 * Collection Detail Builder workspace — MUST render inside <Editor>. Save-is-live
 * via PATCH /collections/:id/detail-layout. Wraps the canvas in
 * PreviewCollectionItemProvider so root-level field bindings work on the canvas.
 */
interface CollectionDetailBuilderShellProps {
  siteId: string | null;
  collection: Collection;
  initialJson: string | null;
}

export const CollectionDetailBuilderShell: React.FC<CollectionDetailBuilderShellProps> = ({
  siteId,
  collection,
  initialJson,
}) => {
  const navigate = useNavigate();
  const { state: saveState, saveNow } = useCollectionDetailAutosave(collection.id);
  const rightPanelCollapsed = useEditorUiStore((s) => s.rightPanelCollapsed);
  useEditorShortcuts();

  const { data: publishedPage } = useItems(collection.id, {
    pageSize: 1,
    status: "published",
  });
  const { data: draftPage } = useItems(collection.id, {
    pageSize: 1,
    status: "draft",
  });

  const previewItem = React.useMemo(
    () => pickPreviewItem(publishedPage?.items, draftPage?.items),
    [publishedPage?.items, draftPage?.items],
  );

  return (
    <div className="flex h-screen flex-col">
      <CollectionDetailBuilderToolbar
        collectionName={collection.name}
        collectionSlug={collection.slug}
        saveState={saveState}
        onBack={() => navigate(`/collections/${collection.id}`)}
        onSave={() => {
          void saveNow()
            .then(() => toast.success("Detail layout saved"))
            .catch(() => toast.error("Could not save detail layout"));
        }}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          <LeftSidebar siteId={siteId} />
          <main className="relative min-w-0 flex-1">
            <PreviewCollectionItemProvider
              collectionId={collection.id}
              collectionSlug={collection.slug}
              fields={collection.fields}
              previewItem={previewItem}
            >
              <Canvas initialJson={initialJson} pageId={collection.id} />
            </PreviewCollectionItemProvider>
          </main>
          {!rightPanelCollapsed && (
            <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-card max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:z-40 max-md:max-h-[45vh] max-md:w-full max-md:rounded-t-xl max-md:shadow-xl">
              <PropertyPanel />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};
