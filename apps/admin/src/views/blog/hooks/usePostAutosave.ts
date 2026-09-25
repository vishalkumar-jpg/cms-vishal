import { useEffect, useRef, useState } from "react";
import { useEditor } from "@craftjs/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import { craftToLayout } from "@/views/builder/craft/serialize";
import type { SaveState } from "@/views/builder/hooks/useAutosave";
import { savePostLayoutRequest } from "../api/blog.api";
import type { Post } from "../types";

/**
 * Save a post's draft layout (PUT /posts/:id/layout). The twin of
 * `useSavePageDraft` — keeps the post's status/meta untouched and only writes
 * the `layout` jsonb. The cache for the single post is refreshed on success.
 */
export const useSavePostDraft = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation<Post, unknown, { postId: string; layout: Record<string, unknown> }>({
    mutationFn: ({ postId, layout }) => savePostLayoutRequest(postId, layout),
    onSuccess: (post) => qc.setQueryData([ADMIN_QUERY_KEYS.POST, siteId, post.id], post),
  });
};

/**
 * Debounced autosave for a post's draft layout — modelled on `useAutosave`
 * (pages) and `useReusableBlockAutosave`. Samples `query.serialize()`; on change
 * it debounces a PUT /posts/:id/layout (serialized via `craftToLayout`).
 * Returns the save state + a manual `saveNow`.
 */
export const usePostAutosave = (
  postId: string | null,
  delay = 1200,
): { state: SaveState; saveNow: () => void } => {
  const { query } = useEditor();
  const siteId = useSiteStore((s) => s.activeSiteId);
  const { mutateAsync } = useSavePostDraft();
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>("");
  const enabled = !!siteId && !!postId;

  const persist = useRef<() => Promise<void>>(async () => {});
  persist.current = async () => {
    if (!enabled) return;
    const json = query.serialize();
    if (json === lastSaved.current) return;
    lastSaved.current = json;
    setState("saving");
    try {
      await mutateAsync({ postId: postId as string, layout: craftToLayout(json) });
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
  }, [enabled, postId, siteId, delay, query]);

  const saveNow = (): void => {
    if (timer.current) clearTimeout(timer.current);
    void persist.current();
  };

  return { state, saveNow };
};
