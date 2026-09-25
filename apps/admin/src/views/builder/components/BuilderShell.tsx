import * as React from "react";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "@/components/ui/toaster";
import { useConfirm } from "@/components/ui/confirm-provider";
import {
  PUBLISH_CONFIRM_DESCRIPTION,
  PUBLISH_CONFIRM_LABEL,
} from "@/components/ui/confirm-labels";
import { usePublishPage, usePage } from "@/views/pages/hooks/usePages";
import { readPageProvenance } from "@/views/pages/lib/pageProvenance";
import { isHomepageSlug, normalizePageLayoutOptions, stripChromeFromLayout } from "@ob-cms/block-schema";
import { LeftSidebar } from "./LeftSidebar";
import { Canvas } from "./Canvas";
import { BuilderToolbar } from "./BuilderToolbar";
import { PropertyPanel } from "../property/PropertyPanel";
import { SaveTemplateDialog } from "./SaveTemplateDialog";
import { PageSettingsDialog } from "./PageSettingsDialog";
import { VersionHistoryDrawer } from "./VersionHistoryDrawer";
import { ScheduleDialog } from "./ScheduleDialog";
import { InlineBlockToolbar } from "./InlineBlockToolbar";
import { BlockContextMenu } from "./BlockContextMenu";
import { AiBlockMenu } from "./AiBlockMenu";
import { A11yMarkers } from "../a11y/A11yMarkers";
import { AiGenerateSectionDialog } from "./AiGenerateSectionDialog";
import { Sparkles } from "lucide-react";
import { useEditorShortcuts } from "../hooks/useEditorShortcuts";
import { useAutosave } from "../hooks/useAutosave";
import { useEditLock } from "../lock/useEditLock";
import { EditLockBanner } from "../lock/EditLockBanner";
import { createPagePreviewLinkRequest } from "@/views/pages/api/pages.api";
import { CommentsOverlay } from "../comments/CommentsOverlay";
import { CommentsPanel } from "../comments/CommentsPanel";
import { FindReplacePanel } from "../find/FindReplacePanel";
import { useCollabStore } from "../store/collabStore";
import { OverlayLayer } from "../overlay/OverlayLayer";
import { MarqueeSelect } from "../overlay/MarqueeSelect";
import { useEditorUiStore } from "../store/editorUiStore";
import { BuilderScrollFX } from "./BuilderScrollFX";
import { SectionQuickInsert } from "./SectionQuickInsert";
import { FloatingTextToolbar } from "./FloatingTextToolbar";
import { GlobalStylesDialog } from "./GlobalStylesDialog";
import { DiagnosticsPanel } from "../diagnostics/DiagnosticsPanel";
import { AlignToolbar } from "./AlignToolbar";
import { GridOverlay } from "./GridOverlay";
import { ResponsiveCompareStrip } from "./ResponsiveCompareStrip";
import { ResponsiveMarkers } from "./ResponsiveMarkers";
import { BreakpointManager } from "./BreakpointManager";
import { RulersOverlay } from "./RulersOverlay";
import { OnboardingTour } from "../onboarding/OnboardingTour";
import { HelpCenterPanel } from "../help/HelpCenterPanel";
import { SessionRecoveryDialog } from "../recovery/SessionRecovery";
import { useFindReplaceShortcut } from "../find/useFindReplaceShortcut";
import { useUnsavedChangesGuard } from "../hooks/useUnsavedChangesGuard";
import { ConfirmEditorBridge } from "./ConfirmEditorBridge";

const BuilderCommandPalette = React.lazy(() =>
  import("./BuilderCommandPalette").then((m) => ({ default: m.BuilderCommandPalette })),
);

/**
 * The builder workspace — MUST be rendered inside <Editor>. Wires shortcuts,
 * autosave, the panels, and the save/publish actions.
 */
interface BuilderShellProps {
  siteId: string | null;
  pageId: string | null;
  pageTitle: string;
  initialJson: string | null;
}

export const BuilderShell: React.FC<BuilderShellProps> = ({
  siteId,
  pageId,
  pageTitle,
  initialJson,
}) => {
  const navigate = useNavigate();
  const [templateOpen, setTemplateOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [aiSectionOpen, setAiSectionOpen] = React.useState(false);
  const [cmdOpen, setCmdOpen] = React.useState(false);
  const [globalStylesOpen, setGlobalStylesOpen] = React.useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = React.useState(false);
  const [breakpointMgrOpen, setBreakpointMgrOpen] = React.useState(false);
  const helpCenterOpen = useEditorUiStore((s) => s.helpCenterOpen);
  const setHelpCenterOpen = useEditorUiStore((s) => s.setHelpCenterOpen);
  const rightPanelCollapsed = useEditorUiStore((s) => s.rightPanelCollapsed);
  const { data: page } = usePage(siteId, pageId);
  const beforePersist = React.useCallback(
    (layout: Parameters<typeof stripChromeFromLayout>[0]) => {
      if (!page || isHomepageSlug(page.slug)) return layout;
      const opts = normalizePageLayoutOptions(page.layoutOptions);
      if (opts.inheritHomepageChrome) return stripChromeFromLayout(layout);
      return layout;
    },
    [page],
  );
  const { state: saveState, saveNow } = useAutosave(
    siteId,
    pageId,
    1200,
    initialJson,
    beforePersist,
  );
  const confirm = useConfirm();
  const publish = usePublishPage(siteId);
  const showA11yMarkers = useEditorUiStore((s) => s.showA11yMarkers);
  // CONTENT-OPS — advisory concurrent-edit lock (acquire on open, heartbeat,
  // release on unmount). Never blocks a save; only warns via the banner.
  const lock = useEditLock("pages", pageId, !!pageId && !!siteId);
  useEditorShortcuts();
  useFindReplaceShortcut();
  useUnsavedChangesGuard(!!pageId);
  const hasUnsavedEdits = useEditorUiStore((s) => s.hasUnsavedEdits);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  const commentMode = useCollabStore((s) => s.commentMode);
  const commentsPanelOpen = useCollabStore((s) => s.commentsPanelOpen);
  const findOpen = useCollabStore((s) => s.findOpen);
  const toggleCommentMode = useCollabStore((s) => s.toggleCommentMode);
  const setCommentsPanelOpen = useCollabStore((s) => s.setCommentsPanelOpen);
  const setFindOpen = useCollabStore((s) => s.setFindOpen);

  const onPublish = async (): Promise<void> => {
    if (!pageId) return;
    const ok = await confirm({
      title: pageTitle ? `Publish "${pageTitle}"?` : "Publish this page?",
      description: PUBLISH_CONFIRM_DESCRIPTION,
      confirmLabel: PUBLISH_CONFIRM_LABEL,
    });
    if (!ok) return;
    saveNow();
    try {
      await publish.mutateAsync(pageId);
      toast.success("Page published");
    } catch {
      toast.error("Publish failed");
    }
  };

  // CONTENT-OPS — mint a shareable no-login draft preview link + copy it.
  const onCopyPreviewLink = async (): Promise<void> => {
    if (!pageId || !siteId) return;
    saveNow();
    try {
      const { url } = await createPagePreviewLinkRequest(siteId, pageId);
      await navigator.clipboard.writeText(url);
      toast.success("Preview link copied — anyone with it can view the draft");
    } catch {
      toast.error("Could not create preview link");
    }
  };

  return (
    <div className="flex h-screen flex-col">
      <ConfirmEditorBridge />
      {lock.blockedBy ? (
        <EditLockBanner holder={lock.blockedBy} onTakeOver={lock.takeOver} />
      ) : null}
      <BuilderToolbar
        pageTitle={pageTitle}
        provenance={readPageProvenance(page)}
        saveState={saveState}
        hasUnsavedEdits={hasUnsavedEdits}
        isPublishing={publish.isPending}
        onBack={() => navigate("/pages")}
        onSave={() => {
          saveNow();
          toast.success("Draft saved");
        }}
        onPublish={() => void onPublish()}
        onSaveTemplate={() => setTemplateOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onHistory={() => setHistoryOpen(true)}
        onSchedule={() => setScheduleOpen(true)}
        onPreview={() => {
          // Persist the latest draft, then open the full-screen draft preview in
          // a new tab so the editor stays put.
          saveNow();
          if (pageId) window.open(`/pages/${pageId}/preview`, "_blank", "noopener");
        }}
        onCopyPreviewLink={() => void onCopyPreviewLink()}
        commentMode={commentMode}
        onToggleCommentMode={toggleCommentMode}
        onOpenComments={() => setCommentsPanelOpen(true)}
        onOpenFind={() => setFindOpen(true)}
        onOpenBreakpointManager={() => setBreakpointMgrOpen(true)}
        onOpenHelp={() => setHelpCenterOpen(true)}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          <LeftSidebar siteId={siteId} />
          <main className="relative min-w-0 flex-1" role="main" aria-label="Page canvas">
            <Canvas initialJson={initialJson} pageId={pageId} />
            <ResponsiveCompareStrip />
          </main>
          {!rightPanelCollapsed && (
            <aside
              data-tour="property-panel"
              className="flex w-80 shrink-0 flex-col border-l border-border bg-card max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:z-40 max-md:max-h-[45vh] max-md:w-full max-md:rounded-t-xl max-md:shadow-xl"
            >
              <PropertyPanel />
            </aside>
          )}
        </div>
      </div>
      {/* On-canvas overlays (fixed position, mounted inside <Editor>): the
          direct-manipulation layer (resize handles, spacing bands, drop
          indicator, snap guides) tracks the selection; the inline block
          toolbar and context menu reuse the shared node actions. */}
      <OverlayLayer />
      <GridOverlay />
      <RulersOverlay />
      <ResponsiveMarkers />
      <AlignToolbar />
      <MarqueeSelect />
      <SectionQuickInsert />
      <BuilderScrollFX />
      <FloatingTextToolbar />
      <InlineBlockToolbar />
      <BlockContextMenu />
      <AiBlockMenu />
      {/* A11y: lightweight per-node warning markers (own fixed layer). Opt-in —
          editor-only hints, never shown on the published page. */}
      {showA11yMarkers && <A11yMarkers />}
      {/* COLLAB — comment pins overlay (own fixed layer), threads panel, and the
          find & replace panel. All read node rects; none touch canvas internals. */}
      {(commentMode || commentsPanelOpen) && (
        <>
          <CommentsOverlay pageId={pageId} />
          <CommentsPanel pageId={pageId} />
        </>
      )}
      {findOpen && <FindReplacePanel />}
      {/* ✨ Generate section — a floating + affordance over the canvas. */}
      <button
        type="button"
        onClick={() => setAiSectionOpen(true)}
        title="Generate a section with AI"
        className="fixed bottom-5 right-[22rem] z-40 flex items-center gap-1.5 rounded-full border border-border bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-lg transition hover:opacity-90"
      >
        <Sparkles className="h-4 w-4" />
        Generate section
      </button>
      <AiGenerateSectionDialog open={aiSectionOpen} onOpenChange={setAiSectionOpen} />
      <SaveTemplateDialog siteId={siteId} open={templateOpen} onOpenChange={setTemplateOpen} />
      <PageSettingsDialog
        siteId={siteId}
        pageId={pageId}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
      <VersionHistoryDrawer
        siteId={siteId}
        pageId={pageId}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
      <ScheduleDialog
        siteId={siteId}
        pageId={pageId}
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
      />
      {cmdOpen ? (
        <React.Suspense
          fallback={
            <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/20 pt-[20vh]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <BuilderCommandPalette
            open={cmdOpen}
            onOpenChange={setCmdOpen}
            pageTitle={pageTitle}
            onSettings={() => setSettingsOpen(true)}
            onHistory={() => setHistoryOpen(true)}
            onPreview={() => {
              saveNow();
              if (pageId) window.open(`/pages/${pageId}/preview`, "_blank", "noopener");
            }}
            onSave={() => {
              saveNow();
              toast.success("Draft saved");
            }}
            onPublish={() => void onPublish()}
            onDiagnostics={() => setDiagnosticsOpen(true)}
            onGlobalStyles={() => setGlobalStylesOpen(true)}
            onOpenHelp={() => setHelpCenterOpen(true)}
          />
        </React.Suspense>
      ) : null}
      <GlobalStylesDialog open={globalStylesOpen} onOpenChange={setGlobalStylesOpen} />
      {diagnosticsOpen ? (
        <div className="fixed inset-y-0 right-80 z-[75] w-80 border-l border-border bg-card shadow-xl">
          <DiagnosticsPanel onClose={() => setDiagnosticsOpen(false)} />
        </div>
      ) : null}
      <BreakpointManager open={breakpointMgrOpen} onOpenChange={setBreakpointMgrOpen} />
      <OnboardingTour />
      <SessionRecoveryDialog pageId={pageId} initialSerialized={initialJson} />
      {helpCenterOpen ? (
        <div className="fixed inset-y-0 right-0 z-[85] w-80 border-l border-border bg-card shadow-xl max-md:inset-x-0 max-md:w-full">
          <HelpCenterPanel onClose={() => setHelpCenterOpen(false)} />
        </div>
      ) : null}
    </div>
  );
};
