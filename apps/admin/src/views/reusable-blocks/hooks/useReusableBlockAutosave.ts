import { useEffect, useRef, useState } from "react";
import { useEditor } from "@craftjs/core";
import type { ComponentProp, ComponentVariant } from "@ob-cms/block-schema";
import { layoutHasContent } from "@ob-cms/block-schema";
import { craftJsonToFragmentLayout } from "@/views/builder/craft/fragmentEditorLayout";
import { useUpdateReusableBlock } from "./useReusableBlocks";
import type { SaveState } from "@/views/builder/hooks/useAutosave";
import { useEditorUiStore } from "@/views/builder/store/editorUiStore";
import { toast } from "@/components/ui/toaster";

/**
 * The COMPONENTS definition (declared props + variants) the editor autosaves
 * alongside the layout. Passed as a ref so the polling effect never restarts on
 * every keystroke — the persist closure always reads the latest value.
 */
export interface ComponentDefRef {
  current: { props: ComponentProp[]; variants: ComponentVariant[] };
}

/**
 * Debounced autosave for a reusable block's source layout (REUSE-BLOCKS) — the
 * reusable-block twin of `useAutosave`. Samples `query.serialize()` PLUS
 * the component def (props/variants); on change it debounces a PUT
 * /reusable-blocks/:id (layout serialized via `craftJsonToFragmentLayout`). Saving
 * purges the render cache so every instance re-resolves the new source. MVP: save = live.
 * Returns the save state + a manual `saveNow`.
 */
export const useReusableBlockAutosave = (
  siteId: string | null,
  id: string | null,
  defRef?: ComponentDefRef,
  delay = 1200,
  /** Craft JSON the canvas was bootstrapped with — avoids saving before load. */
  initialSerialized: string | null = null,
): { state: SaveState; saveNow: () => void } => {
  const { query } = useEditor();
  const { mutateAsync } = useUpdateReusableBlock(siteId, id);
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>("");
  const hadContentOnLoad = useRef(false);
  const enabled = !!siteId && !!id;

  /** A change-detection signature combining the layout + the component def. */
  const signature = (): string =>
    JSON.stringify({ layout: query.serialize(), def: defRef?.current ?? null });

  const persist = useRef<() => Promise<void>>(async () => {});
  persist.current = async () => {
    if (!enabled) return;
    const sig = signature();
    if (sig === lastSaved.current) return;

    const layout = craftJsonToFragmentLayout(query.serialize());
    if (!layoutHasContent(layout) && hadContentOnLoad.current) {
      setState("error");
      toast.error("Save skipped — the editor was not ready. Try Save again.");
      return;
    }

    setState("saving");
    try {
      await mutateAsync({
        layout,
        ...(defRef
          ? { props: defRef.current.props, variants: defRef.current.variants }
          : {}),
      });
      lastSaved.current = sig;
      setState("saved");
    } catch {
      setState("error");
      toast.error("Could not save reusable block — check your connection and try again.");
    }
  };

  useEffect(() => {
    if (!enabled) return;
    lastSaved.current = initialSerialized ?? "";

    hadContentOnLoad.current = false;
    if (initialSerialized) {
      try {
        const layout = craftJsonToFragmentLayout(initialSerialized);
        hadContentOnLoad.current = layoutHasContent(layout);
      } catch {
        hadContentOnLoad.current = false;
      }
    }

    let idleId: number | undefined;
    if (!initialSerialized) {
      idleId = requestIdleCallback(() => {
        try {
          if (!lastSaved.current) lastSaved.current = signature();
        } catch {
          /* editor not ready */
        }
      });
    }

    let lastCheckedVersion = useEditorUiStore.getState().dirtyVersion;
    let lastSeen = lastSaved.current;
    const interval = window.setInterval(() => {
      const version = useEditorUiStore.getState().dirtyVersion;
      if (version === lastCheckedVersion) return;
      lastCheckedVersion = version;
      const sig = signature();
      if (sig !== lastSeen) {
        lastSeen = sig;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void persist.current(), delay);
      }
    }, 500);
    return () => {
      if (idleId != null) cancelIdleCallback(idleId);
      window.clearInterval(interval);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, id, siteId, delay, query, initialSerialized]);

  const saveNow = (): void => {
    if (timer.current) clearTimeout(timer.current);
    void persist.current();
  };

  return { state, saveNow };
};
