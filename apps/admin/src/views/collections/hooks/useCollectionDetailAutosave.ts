import { useEffect, useRef, useState } from "react";
import { useEditor } from "@craftjs/core";
import type { SerializedLayout } from "@ob-cms/block-schema";
import { craftToLayout } from "@/views/builder/craft/serialize";
import { applyAutoResponsiveToLayout } from "@/views/builder/craft/autoResponsive";
import type { SaveState } from "@/views/builder/hooks/useAutosave";
import { useEditorUiStore } from "@/views/builder/store/editorUiStore";
import { useSaveCollectionDetailLayout } from "./useCollections";

/**
 * Debounced autosave for a collection's shared detail layout — save-is-live
 * (GlobalsBuilder pattern). Samples Craft dirtyVersion; on change debounces a
 * PATCH /collections/:id/detail-layout with craftToLayout + auto-responsive.
 */
export const useCollectionDetailAutosave = (
  collectionId: string | null,
  delay = 1200,
): { state: SaveState; saveNow: () => Promise<void> } => {
  const { query } = useEditor();
  const { mutateAsync } = useSaveCollectionDetailLayout();
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>("");
  const inFlight = useRef<Promise<void>>(Promise.resolve());
  const enabled = !!collectionId;

  const runPersist = async (): Promise<void> => {
    if (!enabled) return;
    const json = query.serialize();
    if (json === lastSaved.current) return;
    setState("saving");
    try {
      const layout = applyAutoResponsiveToLayout(craftToLayout(json));
      await mutateAsync({
        collectionId: collectionId as string,
        detailLayout: layout as SerializedLayout,
      });
      lastSaved.current = json;
      setState("saved");
      useEditorUiStore.getState().setHasUnsavedEdits(false);
    } catch {
      setState("error");
      throw new Error("save failed");
    }
  };

  const enqueuePersist = (): Promise<void> => {
    const next = inFlight.current.then(() => runPersist());
    inFlight.current = next.catch(() => undefined);
    return next;
  };

  useEffect(() => {
    if (!enabled) return;
    try {
      lastSaved.current = query.serialize();
    } catch {
      lastSaved.current = "";
    }
    let lastCheckedVersion = useEditorUiStore.getState().dirtyVersion;
    let lastSeen = lastSaved.current;
    const interval = window.setInterval(() => {
      const version = useEditorUiStore.getState().dirtyVersion;
      if (version === lastCheckedVersion) return;
      lastCheckedVersion = version;
      const json = query.serialize();
      if (json !== lastSeen) {
        lastSeen = json;
        useEditorUiStore.getState().setHasUnsavedEdits(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          timer.current = null;
          void enqueuePersist().catch(() => {
            // Error state is already handled inside runPersist().
          });
        }, delay);
      }
    }, 500);
    return () => {
      window.clearInterval(interval);
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        void enqueuePersist().catch(() => {
          // Error state is already handled inside runPersist().
        });
      }
    };
  }, [enabled, collectionId, delay, query]);

  const saveNow = (): Promise<void> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    return enqueuePersist();
  };

  return { state, saveNow };
};
