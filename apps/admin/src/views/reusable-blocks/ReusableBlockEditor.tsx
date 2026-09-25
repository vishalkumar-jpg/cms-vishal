import * as React from "react";
import { useParams } from "react-router";
import { Editor } from "@craftjs/core";
import { Loader2 } from "lucide-react";
import { useSiteStore } from "@/store/siteStore";
import { resolver } from "@/views/builder/craft/resolver";
import { layoutToFragmentEditorJson } from "@/views/builder/craft/fragmentEditorLayout";
import { useEditorUiStore } from "@/views/builder/store/editorUiStore";
import { ReusableBlockBuilderShell } from "./components/ReusableBlockBuilderShell";
import { useReusableBlock } from "./hooks/useReusableBlocks";

/**
 * REUSE-BLOCKS source editor route (`/reusable/:id`). Loads the reusable block,
 * deserializes its SerializedLayout into Craft node JSON, and mounts the SAME
 * <Editor> + resolver as the page builder so the source renders with the real
 * shared blocks. Saving updates the source → all references re-resolve on next
 * render (cache purged on save).
 */
export const ReusableBlockEditor: React.FC = () => {
  const { id = null } = useParams();
  const siteId = useSiteStore((s) => s.activeSiteId);
  const { data: block, isLoading, isError } = useReusableBlock(siteId, id);

  const [initialJson, setInitialJson] = React.useState<string | null>(null);
  const [layoutReady, setLayoutReady] = React.useState(false);
  const bootstrappedId = React.useRef<string | null>(null);

  React.useEffect(() => {
    bootstrappedId.current = null;
    setInitialJson(null);
    setLayoutReady(false);
    useEditorUiStore.setState({ dirtyVersion: 0 });
  }, [id]);

  // Hydrate Craft JSON once per open — NOT on every autosave cache update.
  React.useEffect(() => {
    if (!block || !id || bootstrappedId.current === id) return;
    try {
      setInitialJson(block.layout ? layoutToFragmentEditorJson(block.layout) : null);
    } catch {
      setInitialJson(null);
    }
    setLayoutReady(true);
    bootstrappedId.current = id;
  }, [block, id]);

  if (isLoading || (block && !layoutReady)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !block) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Could not load this reusable block. It may not exist or the API is unavailable.
      </div>
    );
  }

  return (
    <Editor
      key={block.id}
      resolver={resolver}
      onNodesChange={() => useEditorUiStore.getState().bumpDirty()}
      indicator={{ success: "hsl(var(--primary))", error: "#ef4444" }}
    >
      <ReusableBlockBuilderShell
        siteId={siteId}
        blockId={block.id}
        name={block.name}
        initialJson={initialJson}
        initialProps={block.props ?? []}
        initialVariants={block.variants ?? []}
      />
    </Editor>
  );
};
