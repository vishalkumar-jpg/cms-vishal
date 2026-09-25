import { useEffect, useRef, useState } from "react";
import { useEditor } from "@craftjs/core";
import { craftToLayout } from "@/views/builder/craft/serialize";
import { useSaveSiteChrome } from "./useSiteChrome";
import type { ChromeSlot } from "../api/globals.api";
import type { SaveState } from "@/views/builder/hooks/useAutosave";

/**
 * Debounced autosave for a global chrome slot (header/footer) — the chrome twin
 * of the page builder's `useAutosave`. Samples `query.serialize()`; on change it
 * debounces a PUT /site-chrome of the chosen slot (serialized into a
 * SerializedLayout via `craftToLayout`). MVP: save = live. Returns the save
 * state + a manual `saveNow`.
 */
export const useChromeAutosave = (
  siteId: string | null,
  slot: ChromeSlot,
  delay = 1200,
): { state: SaveState; saveNow: () => void } => {
  const { query } = useEditor();
  const { mutateAsync } = useSaveSiteChrome(siteId, slot);
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>("");
  const enabled = !!siteId;

  const persist = useRef<() => Promise<void>>(async () => {});
  persist.current = async () => {
    if (!enabled) return;
    const json = query.serialize();
    if (json === lastSaved.current) return;
    lastSaved.current = json;
    setState("saving");
    try {
      await mutateAsync(craftToLayout(json));
      setState("saved");
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    if (!enabled) return;
    let lastSeen = query.serialize();
    lastSaved.current = lastSeen;
    const interval = window.setInterval(() => {
      const json = query.serialize();
      if (json !== lastSeen) {
        lastSeen = json;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void persist.current(), delay);
      }
    }, 500);
    return () => {
      window.clearInterval(interval);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, slot, siteId, delay, query]);

  const saveNow = (): void => {
    if (timer.current) clearTimeout(timer.current);
    void persist.current();
  };

  return { state, saveNow };
};
