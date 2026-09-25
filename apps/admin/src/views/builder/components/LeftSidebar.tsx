import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import { useEditorUiStore } from "../store/editorUiStore";
import { Palette } from "./Palette";
import { BuilderTip } from "./BuilderTip";
import { MY_TEMPLATES_TAB_LABEL } from "@/views/template-library/constants";

// Lazy-load the non-default panels: each is only downloaded/evaluated the first
// time its tab is opened (Radix Tabs unmounts inactive content), keeping the
// initial builder bundle and first render lean. Blocks (Palette) stays eager as
// it's the default tab.
const LayersPanel = React.lazy(() =>
  import("./LayersPanel").then((m) => ({ default: m.LayersPanel })),
);
const TemplatesPanel = React.lazy(() =>
  import("./TemplatesPanel").then((m) => ({ default: m.TemplatesPanel })),
);
const ReusableBlocksPanel = React.lazy(() =>
  import("./ReusableBlocksPanel").then((m) => ({ default: m.ReusableBlocksPanel })),
);
const SectionLibraryPanel = React.lazy(() =>
  import("./SectionLibraryPanel").then((m) => ({ default: m.SectionLibraryPanel })),
);
const AssetManagerPanel = React.lazy(() =>
  import("./AssetManagerPanel").then((m) => ({ default: m.AssetManagerPanel })),
);

const PanelFallback: React.FC = () => (
  <div className="flex items-center justify-center py-8 text-muted-foreground">
    <Loader2 className="h-4 w-4 animate-spin" />
  </div>
);

const SIDEBAR_TABS: { value: string; label: string; hint: string }[] = [
  { value: "blocks", label: "Blocks", hint: "Drag individual blocks onto the page" },
  { value: "sections", label: "Sections", hint: "Pre-built section layouts you can drop in" },
  { value: "assets", label: "Assets", hint: "Your images and videos — drag onto the canvas" },
  { value: "layers", label: "Layers", hint: "Page structure as a tree — rename, hide, or lock" },
  { value: "templates", label: MY_TEMPLATES_TAB_LABEL, hint: "Layouts you've saved for this site" },
  { value: "reusable", label: "Reusable", hint: "Saved blocks you can reuse across pages" },
];

export const LeftSidebar: React.FC<{ siteId: string | null }> = ({ siteId }) => {
  const leftTab = useEditorUiStore((s) => s.leftTab);
  const setLeftTab = useEditorUiStore((s) => s.setLeftTab);
  const collapsed = useEditorUiStore((s) => s.leftPanelCollapsed);

  if (collapsed) return null;

  return (
    <aside
      data-tour="left-sidebar"
      className="flex w-64 shrink-0 flex-col border-r border-border bg-card max-md:absolute max-md:inset-y-14 max-md:left-0 max-md:z-30 max-md:shadow-lg"
    >
      <Tabs
        value={leftTab}
        onValueChange={(v) => setLeftTab(v as typeof leftTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsPrimitive.List className="flex flex-wrap gap-1.5 px-3 pt-3" aria-label="Sidebar panels">
            {SIDEBAR_TABS.map((tab) => {
              const isActive = leftTab === tab.value;
              return (
                <BuilderTip key={tab.value} content={tab.hint} side="bottom">
                  <TabsPrimitive.Trigger
                    value={tab.value}
                    aria-label={tab.label}
                    className={cn(
                      "ob-sidebar-tab inline-flex min-h-8 grow basis-[4.5rem] items-center justify-center rounded-md border px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                      isActive
                        ? "is-active border-primary bg-primary text-primary-foreground font-semibold shadow-sm"
                        : "border-border bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </TabsPrimitive.Trigger>
                </BuilderTip>
              );
            })}
          </TabsPrimitive.List>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <TabsContent value="blocks">
            <Palette />
          </TabsContent>
          <TabsContent value="sections">
            <React.Suspense fallback={<PanelFallback />}>
              <SectionLibraryPanel />
            </React.Suspense>
          </TabsContent>
          <TabsContent value="assets">
            <React.Suspense fallback={<PanelFallback />}>
              <AssetManagerPanel />
            </React.Suspense>
          </TabsContent>
          <TabsContent value="layers">
            <React.Suspense fallback={<PanelFallback />}>
              <LayersPanel />
            </React.Suspense>
          </TabsContent>
          <TabsContent value="templates">
            <React.Suspense fallback={<PanelFallback />}>
              <TemplatesPanel siteId={siteId} />
            </React.Suspense>
          </TabsContent>
          <TabsContent value="reusable">
            <React.Suspense fallback={<PanelFallback />}>
              <ReusableBlocksPanel siteId={siteId} />
            </React.Suspense>
          </TabsContent>
        </div>
      </Tabs>
    </aside>
  );
};
