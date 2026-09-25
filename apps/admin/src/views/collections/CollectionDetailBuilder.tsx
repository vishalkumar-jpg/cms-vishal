import * as React from "react";
import { useParams } from "react-router";
import { Editor } from "@craftjs/core";
import { Loader2 } from "lucide-react";
import { emptyLayout } from "@ob-cms/block-schema";
import { useSiteStore } from "@/store/siteStore";
import { resolver } from "@/views/builder/craft/resolver";
import { layoutToCraft } from "@/views/builder/craft/serialize";
import { useEditorUiStore } from "@/views/builder/store/editorUiStore";
import { useCollection } from "./hooks/useCollections";
import { CollectionDetailBuilderShell } from "./components/CollectionDetailBuilderShell";

/**
 * Collection Detail Builder route (`/collections/:id/detail-builder`). Loads the
 * collection's shared detailLayout, deserializes into Craft node JSON, and
 * mounts the same <Editor> + resolver as the page builder. Autosave PATCHes
 * /collections/:id/detail-layout (save = live).
 */
export const CollectionDetailBuilder: React.FC = () => {
  const { id = null } = useParams();
  const siteId = useSiteStore((s) => s.activeSiteId);
  const { data: collection, isLoading, isError } = useCollection(id);

  const [initialJson, setInitialJson] = React.useState<string | null>(null);
  const [layoutReady, setLayoutReady] = React.useState(false);
  /** Hydrate Craft once per collection open — not on autosave cache updates. */
  const bootstrappedCollectionId = React.useRef<string | null>(null);

  React.useEffect(() => {
    bootstrappedCollectionId.current = null;
    setInitialJson(null);
    setLayoutReady(false);
    useEditorUiStore.getState().setHasUnsavedEdits(false);
  }, [id]);

  React.useEffect(() => {
    if (isLoading || !collection || !id) return;
    if (bootstrappedCollectionId.current === id) return;

    const layout = collection.detailLayout ?? emptyLayout();
    try {
      setInitialJson(JSON.stringify(layoutToCraft(layout)));
    } catch {
      setInitialJson(null);
    }
    setLayoutReady(true);
    bootstrappedCollectionId.current = id;
  }, [isLoading, collection, id]);

  if (isError || (!isLoading && !collection)) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Could not load this collection. It may not exist or the collections API is unavailable.
      </div>
    );
  }

  if (isLoading || !layoutReady || !collection) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Editor
      key={collection.id}
      resolver={resolver}
      onNodesChange={() => useEditorUiStore.getState().bumpDirty()}
      indicator={{ success: "hsl(var(--primary))", error: "#ef4444" }}
    >
      <CollectionDetailBuilderShell
        siteId={siteId}
        collection={collection}
        initialJson={initialJson}
      />
    </Editor>
  );
};
