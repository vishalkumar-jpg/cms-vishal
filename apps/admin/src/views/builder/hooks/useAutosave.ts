import { useEffect, useRef, useState } from "react";
import { useEditor } from "@craftjs/core";
import { useSavePageDraft } from "@/views/pages/hooks/usePages";
import { craftToLayout } from "../craft/serialize";
import { applyAutoResponsiveToLayout } from "../craft/autoResponsive";
import type { SerializedLayout } from "@ob-cms/block-schema";
import { useEditorUiStore } from "../store/editorUiStore";
import { clearSessionBackup } from "../recovery/SessionRecovery";
import { toast } from "@/components/ui/toaster";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Debounced autosave. A lightweight change detector samples `query.serialize()`;
 * when the serialized tree changes, it debounces a PATCH of the page draft
 * through the wrapped `useSavePageDraft` hook (serializing into SerializedLayout
 * via `craftToLayout`). Returns the save state + a manual `saveNow`.
 */
export const useAutosave = (
  siteId: string | null,
  pageId: string | null,
  delay = 1200,
  initialSerialized: string | null = null,
  beforePersist?: (layout: SerializedLayout) => SerializedLayout,
): { state: SaveState; saveNow: () => void } => {
  const { query } = useEditor();
  const { mutateAsync } = useSavePageDraft(siteId);
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>("");
  const enabled = !!siteId && !!pageId;

  const persist = useRef<() => Promise<void>>(async () => {});
  persist.current = async () => {
    if (!enabled) return;
    const json = query.serialize();
    if (json === lastSaved.current) return;
    lastSaved.current = json;
    setState("saving");
    try {
      // Auto-responsive: derive tablet + mobile layers from desktop before
      // persisting, so every saved/published page is mobile-ready with no
      // manual tuning. Applied to the payload only (never the live editor).
      const layout = applyAutoResponsiveToLayout(
        beforePersist ? beforePersist(craftToLayout(json)) : craftToLayout(json),
      );
      await mutateAsync({
        pageId: pageId as string,
        payload: { layout },
      });
      setState("saved");
      useEditorUiStore.getState().setHasUnsavedEdits(false);
      clearSessionBackup();
    } catch {
      setState("error");
      toast.error("Could not save draft — check your connection and try again.");
    }
  };

  useEffect(() => {
    if (!enabled) return;
    lastSaved.current = initialSerialized ?? "";

    let idleId: number | undefined;
    if (!initialSerialized) {
      idleId = requestIdleCallback(() => {
        try {
          if (!lastSaved.current) lastSaved.current = query.serialize();
        } catch {
          /* editor not ready */
        }
      });
    }

    // Only serialize the (large) tree when Craft reports an actual node change
    // since the last poll — `dirtyVersion` is bumped by `<Editor onNodesChange>`.
    // When idle, this poll does a single integer compare and no serialization,
    // instead of re-stringifying the whole document twice a second.
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
        timer.current = setTimeout(() => void persist.current(), delay);
      }
    }, 500);
    return () => {
      if (idleId != null) cancelIdleCallback(idleId);
      window.clearInterval(interval);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, pageId, siteId, delay, query, initialSerialized]);

  const saveNow = (): void => {
    if (timer.current) clearTimeout(timer.current);
    void persist.current();
  };

  return { state, saveNow };
};
