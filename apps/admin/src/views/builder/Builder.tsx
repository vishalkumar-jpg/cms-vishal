import * as React from "react";
import { useParams, useSearchParams } from "react-router";
import { Editor } from "@craftjs/core";
import { Loader2 } from "lucide-react";
import { useSiteStore } from "@/store/siteStore";
import { usePage } from "@/views/pages/hooks/usePages";
import { useComposedPageLayout } from "@/views/pages/hooks/useHomepageLayout";
import {
  BUILDER_PANEL_PARAM,
  rememberLastBuilderPage,
} from "@/views/template-library/lib/builderNavigation";
import { resolver } from "./craft/resolver";
import { prepareCraftJson } from "./craft/layoutPrep";
import { BuilderShell } from "./components/BuilderShell";
import { BuilderErrorBoundary } from "./components/BuilderErrorBoundary";
import { useEditorUiStore } from "./store/editorUiStore";

const BuilderLoading: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex h-screen flex-col items-center justify-center gap-3">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    <p className="text-sm text-muted-foreground">{message}</p>
  </div>
);

/**
 * Visual Page Builder route (`/pages/:pageId/builder`). Loads the page's
 * `draftLayout`, deserializes it into Craft node JSON, and mounts <Editor> with
 * the shared-block resolver. The editor renders the SAME block components as the
 * renderer, so what you build is what ships.
 */
export const Builder: React.FC = () => {
  const { pageId = null } = useParams();
  const [searchParams] = useSearchParams();
  const siteId = useSiteStore((s) => s.activeSiteId);
  const { data: page, isLoading, isError } = usePage(siteId, pageId);
  const { layout: composedLayout, ready: composedReady } = useComposedPageLayout(page, siteId);

  const [initialJson, setInitialJson] = React.useState<string | null>(null);
  const [layoutReady, setLayoutReady] = React.useState(false);
  /** Once hydrated, never re-run layout prep for autosave / query cache updates. */
  const bootstrappedPageId = React.useRef<string | null>(null);

  // New page → reset bootstrap so we hydrate once from the server draft.
  React.useEffect(() => {
    bootstrappedPageId.current = null;
    setInitialJson(null);
    setLayoutReady(false);
    useEditorUiStore.getState().setHasUnsavedEdits(false);
  }, [pageId]);

  React.useEffect(() => {
    if (searchParams.get(BUILDER_PANEL_PARAM) === "templates") {
      useEditorUiStore.getState().setLeftTab("templates");
    }
  }, [pageId, searchParams]);

  // Hydrate Craft JSON exactly once per page open (NOT on every autosave refetch).
  React.useEffect(() => {
    if (isLoading || !page || !pageId || !composedReady) return;
    if (bootstrappedPageId.current === pageId) return;

    if (!composedLayout) {
      setInitialJson(null);
      setLayoutReady(true);
      bootstrappedPageId.current = pageId;
      return;
    }

    let cancelled = false;
    setLayoutReady(false);
    void prepareCraftJson(pageId, page.updatedAt, composedLayout).then((json) => {
      if (cancelled) return;
      setInitialJson(json);
      setLayoutReady(true);
      bootstrappedPageId.current = pageId;
    });

    return () => {
      cancelled = true;
    };
  }, [isLoading, page, pageId, composedLayout, composedReady]);

  // Persist only after the page and layout bootstrap succeed (invalid routes must not overwrite).
  React.useEffect(() => {
    if (!siteId || !pageId || isLoading || isError || !page || !layoutReady || !composedReady) {
      return;
    }
    rememberLastBuilderPage(siteId, pageId);
  }, [siteId, pageId, isLoading, isError, page, layoutReady, composedReady]);

  if (isLoading) {
    return <BuilderLoading message="Loading page…" />;
  }

  if (isError || !page) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Could not load this page. It may not exist or the pages API is unavailable.
      </div>
    );
  }

  if (!layoutReady || !composedReady) {
    return <BuilderLoading message="Preparing page layout…" />;
  }

  return (
    <BuilderErrorBoundary>
      <Editor
        resolver={resolver}
        onNodesChange={() => useEditorUiStore.getState().bumpDirty()}
        indicator={{
          success: "transparent",
          error: "transparent",
          thickness: 0,
          style: { opacity: 0, pointerEvents: "none" },
        }}
      >
        <BuilderShell
          siteId={siteId}
          pageId={pageId}
          pageTitle={page.title}
          initialJson={initialJson}
        />
      </Editor>
    </BuilderErrorBoundary>
  );
};
