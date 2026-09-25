import * as React from "react";
import { useNavigate } from "react-router";
import { toast } from "@/components/ui/toaster";
import { LeftSidebar } from "@/views/builder/components/LeftSidebar";
import { Canvas } from "@/views/builder/components/Canvas";
import { PropertyPanel } from "@/views/builder/property/PropertyPanel";
import { PreviewReusableBlockProvider } from "@/views/builder/components/PreviewReusableBlockProvider";
import { useEditorShortcuts } from "@/views/builder/hooks/useEditorShortcuts";
import { GlobalsToolbar } from "./GlobalsToolbar";
import { useChromeAutosave } from "../hooks/useChromeAutosave";
import type { ChromeSlot } from "../api/globals.api";

/**
 * The GLOBAL-CHROME builder workspace — MUST be rendered inside <Editor>. Wires
 * the same shortcuts/Canvas/LeftSidebar/PropertyPanel as the page builder, but
 * autosaves to the chrome slot (PUT /site-chrome) instead of a page draft, and
 * uses the slimmed-down GlobalsToolbar (save = live; no schedule/versions).
 */
interface GlobalsBuilderShellProps {
  siteId: string | null;
  slot: ChromeSlot;
  initialJson: string | null;
  onSwitchSlot: (slot: ChromeSlot) => void;
}

export const GlobalsBuilderShell: React.FC<GlobalsBuilderShellProps> = ({
  siteId,
  slot,
  initialJson,
  onSwitchSlot,
}) => {
  const navigate = useNavigate();
  const { state: saveState, saveNow } = useChromeAutosave(siteId, slot);
  useEditorShortcuts();

  return (
    <div className="flex h-screen flex-col">
      <GlobalsToolbar
        slot={slot}
        saveState={saveState}
        onBack={() => navigate("/pages")}
        onSave={() => {
          saveNow();
          toast.success(`${slot === "header" ? "Header" : "Footer"} saved`);
        }}
        onSwitchSlot={onSwitchSlot}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          <LeftSidebar siteId={siteId} />
          <main className="relative min-w-0 flex-1">
            <PreviewReusableBlockProvider editorCanvas>
              <Canvas initialJson={initialJson} />
            </PreviewReusableBlockProvider>
          </main>
          <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-card max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:z-40 max-md:max-h-[45vh] max-md:w-full max-md:rounded-t-xl max-md:shadow-xl">
            <PropertyPanel />
          </aside>
        </div>
      </div>
    </div>
  );
};
