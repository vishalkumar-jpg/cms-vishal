import * as React from "react";
import { useEditor } from "@craftjs/core";
import { toast } from "@/components/ui/toaster";
import { useConfirm } from "@/components/ui/confirm-provider";
import { useEditorUiStore } from "../store/editorUiStore";
import {
  craftTreeFilename,
  downloadJsonFile,
  formatCraftExport,
  normalizeImportedCraftJson,
} from "../craft/layoutImportExport";

/**
 * Toolbar export/import — downloads the live Craft node tree and replaces the
 * canvas from a JSON file (with migrate/repair + confirmation).
 */
export const useLayoutImportExport = (pageTitle: string): {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  exportJson: () => void;
  triggerImport: () => void;
  onImportFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
} => {
  const { query, actions } = useEditor();
  const confirm = useConfirm();
  const clearExtraSelected = useEditorUiStore((s) => s.clearExtraSelected);
  const clearSubPart = useEditorUiStore((s) => s.clearSubPart);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const exportJson = React.useCallback(() => {
    try {
      const craftJson = query.serialize();
      downloadJsonFile(craftTreeFilename(pageTitle), formatCraftExport(craftJson));
      toast.success("Layout exported");
    } catch {
      toast.error("Could not export layout");
    }
  }, [query, pageTitle]);

  const triggerImport = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onImportFile = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      void (async () => {
        const ok = await confirm({
          title: "Replace canvas?",
          description:
            "Import will replace the entire canvas. Unsaved changes may be lost. Do you want to continue?",
          confirmLabel: "Import",
          destructive: true,
        });
        if (!ok) return;

        try {
          const text = await file.text();
          const craftJson = normalizeImportedCraftJson(text);
          actions.deserialize(craftJson);
          actions.selectNode();
          actions.clearEvents();
          clearExtraSelected();
          clearSubPart();
          toast.success("Layout imported");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not import layout");
        }
      })();
    },
    [actions, clearExtraSelected, clearSubPart, confirm],
  );

  return { fileInputRef, exportJson, triggerImport, onImportFile };
};
