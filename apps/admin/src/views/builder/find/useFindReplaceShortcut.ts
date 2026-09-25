import { useEffect } from "react";
import { useCollabStore } from "../store/collabStore";

/**
 * Ctrl/Cmd+F opens the builder's Find & Replace panel instead of the browser's
 * native find. Scoped to the builder: while typing in an input/textarea/
 * contentEditable we do NOT hijack the key (so native find-in-field still works),
 * unless that field is our own find box (which handles its own keys). Escape
 * also exits comment mode.
 */
export const useFindReplaceShortcut = (): void => {
  const setFindOpen = useCollabStore((s) => s.setFindOpen);
  const setCommentMode = useCollabStore((s) => s.setCommentMode);
  const setPendingPin = useCollabStore((s) => s.setPendingPin);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "f" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        setFindOpen(true);
        return;
      }
      if (e.key === "Escape") {
        setCommentMode(false);
        setPendingPin(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setFindOpen, setCommentMode, setPendingPin]);
};
