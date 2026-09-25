import * as React from "react";
import { useEditor } from "@craftjs/core";
import { registerEditorSelectionClear } from "../editorSelectionBridge";
import { useEditorUiStore } from "../store/editorUiStore";

/** Registers Craft selection clearing for confirm dialogs (builder only). */
export const ConfirmEditorBridge: React.FC = () => {
  const { actions } = useEditor();
  const actionsRef = React.useRef(actions);
  actionsRef.current = actions;

  React.useEffect(() => {
    registerEditorSelectionClear(() => {
      actionsRef.current.selectNode();
      actionsRef.current.clearEvents();
      useEditorUiStore.getState().clearExtraSelected();
      useEditorUiStore.getState().clearSubPart();
    });
    return () => registerEditorSelectionClear(null);
  }, []);

  return null;
};
