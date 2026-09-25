import * as React from "react";
import { useNavigate } from "react-router";
import type { ComponentProp, ComponentVariant } from "@ob-cms/block-schema";
import { toast } from "@/components/ui/toaster";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeftSidebar } from "@/views/builder/components/LeftSidebar";
import { Canvas } from "@/views/builder/components/Canvas";
import { PropertyPanel } from "@/views/builder/property/PropertyPanel";
import { ComponentPropsPanel } from "@/views/builder/property/ComponentPropsPanel";
import {
  ComponentEditorContext,
  type ComponentEditorContextValue,
} from "@/views/builder/property/ComponentEditorContext";
import { useEditorShortcuts } from "@/views/builder/hooks/useEditorShortcuts";
import { SectionQuickInsert } from "@/views/builder/components/SectionQuickInsert";
import { useEditorUiStore } from "@/views/builder/store/editorUiStore";
import { ReusableBlockToolbar } from "./ReusableBlockToolbar";
import { useReusableBlockAutosave } from "../hooks/useReusableBlockAutosave";

/**
 * The REUSE-BLOCKS source editor workspace — MUST be rendered inside <Editor>.
 * Wires the same shortcuts/Canvas/LeftSidebar/PropertyPanel as the page builder,
 * but autosaves to the reusable block (PUT /reusable-blocks/:id). Saving purges
 * the render cache so every instance re-resolves ("edit once, update everywhere").
 *
 * COMPONENTS: this editor is also the COMPONENT editor. It owns the declared
 * `props`/`variants` state and exposes it via `ComponentEditorContext` so the
 * shared PropertyPanel offers per-node "⚙ use prop" + "mark as Slot" affordances,
 * and a right-rail "Props" tab hosts the props/variants editor. The props/
 * variants are persisted alongside the layout on autosave.
 */
interface ReusableBlockBuilderShellProps {
  siteId: string | null;
  blockId: string | null;
  name: string;
  initialJson: string | null;
  initialProps: ComponentProp[];
  initialVariants: ComponentVariant[];
}

export const ReusableBlockBuilderShell: React.FC<ReusableBlockBuilderShellProps> = ({
  siteId,
  blockId,
  name,
  initialJson,
  initialProps,
  initialVariants,
}) => {
  const navigate = useNavigate();
  const rightPanelCollapsed = useEditorUiStore((s) => s.rightPanelCollapsed);
  const setLeftTab = useEditorUiStore((s) => s.setLeftTab);
  const [props, setProps] = React.useState<ComponentProp[]>(initialProps);
  const [variants, setVariants] = React.useState<ComponentVariant[]>(initialVariants);

  // Autosave samples the live layout AND the current props/variants (via a ref
  // so the polling effect never restarts on every keystroke).
  const defRef = React.useRef({ props, variants });
  defRef.current = { props, variants };
  const { state: saveState, saveNow } = useReusableBlockAutosave(
    siteId,
    blockId,
    defRef,
    1200,
    initialJson,
  );

  useEditorShortcuts();

  // Surface the section library first — reusable blocks are built from sections.
  React.useEffect(() => {
    setLeftTab("sections");
  }, [setLeftTab]);

  const componentCtx = React.useMemo<ComponentEditorContextValue>(
    () => ({ props, setProps, variants, setVariants }),
    [props, variants],
  );

  return (
    <ComponentEditorContext.Provider value={componentCtx}>
      <div className="flex h-screen flex-col">
        <ReusableBlockToolbar
          name={name}
          saveState={saveState}
          onBack={() => navigate("/reusable")}
          onSave={() => {
            saveNow();
            toast.success("Component saved");
          }}
        />
        <div className="flex min-h-0 flex-1">
          <LeftSidebar siteId={siteId} />
          <main className="relative min-w-0 flex-1">
            <Canvas initialJson={initialJson} pageId={blockId} />
            <SectionQuickInsert />
          </main>
          {!rightPanelCollapsed && (
            <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-card max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:z-40 max-md:max-h-[45vh] max-md:w-full max-md:rounded-t-xl max-md:shadow-xl">
            <Tabs defaultValue="inspector" className="flex min-h-0 flex-1 flex-col">
              <div className="px-3 pt-3">
                <TabsList className="w-full">
                  <TabsTrigger value="inspector" className="flex-1">
                    Inspector
                  </TabsTrigger>
                  <TabsTrigger value="props" className="flex-1">
                    Props
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="inspector" className="min-h-0 flex-1 overflow-hidden">
                <PropertyPanel />
              </TabsContent>
              <TabsContent value="props" className="min-h-0 flex-1 overflow-y-auto">
                <ComponentPropsPanel />
              </TabsContent>
            </Tabs>
            </aside>
          )}
        </div>
      </div>
    </ComponentEditorContext.Provider>
  );
};
