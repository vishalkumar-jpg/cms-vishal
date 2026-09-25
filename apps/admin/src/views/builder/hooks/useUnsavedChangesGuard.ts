import * as React from "react";
import { useBlocker } from "react-router";
import { useConfirm } from "@/components/ui/confirm-provider";
import { useEditorUiStore } from "../store/editorUiStore";

/**
 * Blocks in-app navigation when the builder has unsaved edits and shows the
 * app-styled confirm dialog (replaces the browser `beforeunload` prompt).
 * Also attaches a native `beforeunload` listener for browser tab close /
 * refresh, since react-router's blocker only catches in-app navigation.
 */
export const useUnsavedChangesGuard = (enabled = true): void => {
  const hasUnsavedEdits = useEditorUiStore((s) => s.hasUnsavedEdits);
  const confirm = useConfirm();
  const confirmRef = React.useRef(confirm);
  confirmRef.current = confirm;

  const shouldBlock = enabled && hasUnsavedEdits;
  const blocker = useBlocker(
    shouldBlock
      ? ({ currentLocation, nextLocation }) =>
          currentLocation.pathname !== nextLocation.pathname
      : false,
  );

  React.useEffect(() => {
    if (blocker.state !== "blocked") return;
    let cancelled = false;
    void (async () => {
      const ok = await confirmRef.current({
        title: "Leave without saving?",
        description: "You have unsaved changes that may be lost if you leave this page.",
        confirmLabel: "Leave",
        cancelLabel: "Stay",
      });
      if (cancelled) return;
      if (ok) blocker.proceed();
      else blocker.reset();
    })();
    return () => {
      cancelled = true;
    };
  }, [blocker]);

  React.useEffect(() => {
    if (!shouldBlock) return;
    const handler = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
      e.returnValue = "You have unsaved changes that may be lost if you leave this page.";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [shouldBlock]);
};
