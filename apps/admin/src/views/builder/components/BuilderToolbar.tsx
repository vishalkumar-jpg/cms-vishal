import * as React from "react";
import { useEditor } from "@craftjs/core";
import {
  Monitor,
  Tablet,
  Smartphone,
  Undo2,
  Redo2,
  Save,
  Rocket,
  ArrowLeft,
  Check,
  Loader2,
  CircleAlert,
  Settings,
  History,
  CalendarClock,
  Eye,
  Link2,
  MessageSquare,
  Search,
  MousePointer2,
  Type,
  Download,
  Upload,
  Laptop,
  Maximize2,
  Grid3x3,
  Columns2,
  SlidersHorizontal,
  Ruler,
  RotateCw,
  PanelLeft,
  PanelRight,
  MoreHorizontal,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";
import { useEditorUiStore, type EditMode } from "../store/editorUiStore";
import type { Breakpoint } from "../property/styleTokens";
import type { SaveState } from "../hooks/useAutosave";
import { SAVE_AS_MY_TEMPLATE_LABEL } from "@/views/template-library/constants";
import { BuilderToolbarTemplateMenuLinks } from "./BuilderToolbarTemplateMenuLinks";
import { useLayoutImportExport } from "../hooks/useLayoutImportExport";
import type { PageProvenance } from "@/views/pages/lib/pageProvenance";

interface BuilderToolbarProps {
  pageTitle: string;
  /** Phase 3 — read-only template origin (no links / actions). */
  provenance?: PageProvenance | null;
  saveState: SaveState;
  hasUnsavedEdits: boolean;
  isPublishing: boolean;
  onBack: () => void;
  onSave: () => void;
  onPublish: () => void;
  onSaveTemplate: () => void;
  onSettings: () => void;
  onHistory: () => void;
  onSchedule: () => void;
  onPreview: () => void;
  /** CONTENT-OPS — copy a shareable no-login draft preview link. */
  onCopyPreviewLink?: () => void;
  // COLLAB — comment mode toggle, comments panel, find & replace.
  commentMode?: boolean;
  onToggleCommentMode?: () => void;
  onOpenComments?: () => void;
  onOpenFind?: () => void;
  onOpenBreakpointManager?: () => void;
  onOpenHelp?: () => void;
}

const BREAKPOINTS: { key: Breakpoint; icon: React.ReactNode; label: string }[] = [
  { key: "largeDesktop", icon: <Maximize2 className="h-4 w-4" />, label: "Large desktop" },
  { key: "desktop", icon: <Monitor className="h-4 w-4" />, label: "Desktop" },
  { key: "laptop", icon: <Laptop className="h-4 w-4" />, label: "Laptop" },
  { key: "tablet", icon: <Tablet className="h-4 w-4" />, label: "Tablet" },
  { key: "mobile", icon: <Smartphone className="h-4 w-4" />, label: "Mobile" },
];

const EDIT_MODES: { key: EditMode; icon: React.ReactNode; label: string; hint: string }[] = [
  {
    key: "structure",
    icon: <MousePointer2 className="h-4 w-4" />,
    label: "Structure",
    hint: "Structure mode — drag, resize and edit the layout",
  },
  {
    key: "content",
    icon: <Type className="h-4 w-4" />,
    label: "Content",
    hint: "Content mode — inline text/image edits only (no drag or resize)",
  },
];

export const BuilderToolbar: React.FC<BuilderToolbarProps> = ({
  pageTitle,
  provenance = null,
  saveState,
  hasUnsavedEdits,
  isPublishing,
  onBack,
  onSave,
  onPublish,
  onSaveTemplate,
  onSettings,
  onHistory,
  onSchedule,
  onPreview,
  onCopyPreviewLink,
  commentMode,
  onToggleCommentMode,
  onOpenComments,
  onOpenFind,
  onOpenBreakpointManager,
  onOpenHelp,
}) => {
  const breakpoint = useEditorUiStore((s) => s.breakpoint);
  const setBreakpoint = useEditorUiStore((s) => s.setBreakpoint);
  const editMode = useEditorUiStore((s) => s.editMode);
  const setEditMode = useEditorUiStore((s) => s.setEditMode);
  const showA11yMarkers = useEditorUiStore((s) => s.showA11yMarkers);
  const toggleA11yMarkers = useEditorUiStore((s) => s.toggleA11yMarkers);
  const showGridOverlay = useEditorUiStore((s) => s.showGridOverlay);
  const toggleGridOverlay = useEditorUiStore((s) => s.toggleGridOverlay);
  const responsiveCompare = useEditorUiStore((s) => s.responsiveCompare);
  const toggleResponsiveCompare = useEditorUiStore((s) => s.toggleResponsiveCompare);
  const showResponsiveMarkers = useEditorUiStore((s) => s.showResponsiveMarkers);
  const toggleResponsiveMarkers = useEditorUiStore((s) => s.toggleResponsiveMarkers);
  const showRulers = useEditorUiStore((s) => s.showRulers);
  const toggleRulers = useEditorUiStore((s) => s.toggleRulers);
  const previewOrientation = useEditorUiStore((s) => s.previewOrientation);
  const togglePreviewOrientation = useEditorUiStore((s) => s.togglePreviewOrientation);
  const leftPanelCollapsed = useEditorUiStore((s) => s.leftPanelCollapsed);
  const toggleLeftPanel = useEditorUiStore((s) => s.toggleLeftPanel);
  const rightPanelCollapsed = useEditorUiStore((s) => s.rightPanelCollapsed);
  const toggleRightPanel = useEditorUiStore((s) => s.toggleRightPanel);
  const { canUndo, canRedo, actions } = useEditor((_, query) => ({
    canUndo: query.history.canUndo(),
    canRedo: query.history.canRedo(),
  }));
  const { fileInputRef, exportJson, triggerImport, onImportFile } =
    useLayoutImportExport(pageTitle);

  return (
    <header
      className={cn(
        "flex shrink-0 items-center gap-2 border-b border-border bg-card px-2 sm:px-3",
        provenance ? "min-h-14 py-1.5" : "h-14",
      )}
      data-tour="builder-toolbar"
    >
      {/* Left — back + page title (+ optional template provenance) */}
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack} title="Back to pages">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 max-w-[10rem] sm:max-w-[14rem]">
          <p className="truncate text-sm font-semibold leading-none">{pageTitle}</p>
          <SaveIndicator state={saveState} hasUnsavedEdits={hasUnsavedEdits} />
          {provenance ? (
            <div className="mt-1 space-y-0.5 text-[10px] leading-tight text-muted-foreground">
              <p>Created from template</p>
              <p className="truncate font-medium text-foreground/80">{provenance.sourceTemplateKey}</p>
              <p>Version {provenance.sourceTemplateVersion}</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Center — device + canvas tools (scrolls when narrow) */}
      <div className="flex min-w-0 flex-1 items-center justify-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-center gap-1.5 px-1">
          <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border p-0.5">
            {EDIT_MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                title={m.hint}
                aria-pressed={editMode === m.key}
                onClick={() => setEditMode(m.key)}
                className={cn(
                  "flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors",
                  editMode === m.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                {m.icon}
                <span className="hidden lg:inline">{m.label}</span>
              </button>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border p-0.5">
            {BREAKPOINTS.map((bp) => (
              <button
                key={bp.key}
                type="button"
                title={bp.label}
                aria-label={bp.label}
                aria-pressed={breakpoint === bp.key}
                onClick={() => setBreakpoint(bp.key)}
                onContextMenu={(e) => {
                  if (bp.key !== "desktop") {
                    e.preventDefault();
                    onOpenBreakpointManager?.();
                  }
                }}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                  breakpoint === bp.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                {bp.icon}
              </button>
            ))}
            {onOpenBreakpointManager && (
              <button
                type="button"
                title="Custom preview widths"
                aria-label="Custom preview widths"
                onClick={onOpenBreakpointManager}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </button>
            )}
            {(breakpoint === "tablet" || breakpoint === "mobile") && (
              <button
                type="button"
                title={`Switch to ${previewOrientation === "portrait" ? "landscape" : "portrait"} preview`}
                aria-label="Toggle portrait or landscape preview"
                aria-pressed={previewOrientation === "landscape"}
                onClick={togglePreviewOrientation}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                  previewOrientation === "landscape"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                <RotateCw className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="hidden shrink-0 items-center gap-0.5 rounded-lg border border-border p-0.5 md:flex">
            <button
              type="button"
              title="Show pixel rulers"
              aria-label="Toggle rulers"
              aria-pressed={showRulers}
              onClick={toggleRulers}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                showRulers ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Ruler className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Show grid overlay"
              aria-label="Toggle grid overlay"
              aria-pressed={showGridOverlay}
              onClick={toggleGridOverlay}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                showGridOverlay ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Responsive compare"
              aria-label="Toggle responsive compare"
              aria-pressed={responsiveCompare}
              onClick={toggleResponsiveCompare}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                responsiveCompare ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Columns2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Responsive markers"
              aria-label="Toggle responsive markers"
              aria-pressed={showResponsiveMarkers}
              onClick={toggleResponsiveMarkers}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                showResponsiveMarkers ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Tablet className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Right — primary actions + overflow menu */}
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleLeftPanel} title="Toggle left panel" aria-label="Toggle left panel" aria-pressed={!leftPanelCollapsed}>
          <PanelLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleRightPanel} title="Toggle properties panel" aria-label="Toggle properties panel" aria-pressed={!rightPanelCollapsed}>
          <PanelRight className="h-4 w-4" />
        </Button>
        {onOpenHelp && (
          <Button variant="ghost" size="icon" className="hidden h-8 w-8 sm:inline-flex" onClick={onOpenHelp} title="Help center" aria-label="Open help center">
            <HelpCircle className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-8 w-8 sm:inline-flex"
          disabled={!canUndo}
          onClick={() => actions.history.undo()}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-8 w-8 sm:inline-flex"
          disabled={!canRedo}
          onClick={() => actions.history.redo()}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
        <div className="mx-0.5 hidden h-5 w-px bg-border sm:block" />
        <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3" onClick={onPreview} title="Preview the draft">
          <Eye className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Preview</span>
        </Button>
        <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3" onClick={onSave} title="Save draft">
          <Save className="h-4 w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Save</span>
        </Button>
        <Button size="sm" className="h-8 px-2 sm:px-3" onClick={onPublish} disabled={isPublishing} title="Publish">
          {isPublishing ? (
            <Loader2 className="h-4 w-4 animate-spin sm:mr-1.5" />
          ) : (
            <Rocket className="h-4 w-4 sm:mr-1.5" />
          )}
          <span className="hidden sm:inline">Publish</span>
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onImportFile}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="More actions" aria-label="More actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={onSaveTemplate}>{SAVE_AS_MY_TEMPLATE_LABEL}</DropdownMenuItem>
            <BuilderToolbarTemplateMenuLinks />
            <DropdownMenuItem onClick={exportJson}>
              <Download className="mr-2 h-4 w-4" /> Export JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={triggerImport}>
              <Upload className="mr-2 h-4 w-4" /> Import JSON
            </DropdownMenuItem>
            {onCopyPreviewLink && (
              <DropdownMenuItem onClick={onCopyPreviewLink}>
                <Link2 className="mr-2 h-4 w-4" /> Copy preview link
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSettings}>
              <Settings className="mr-2 h-4 w-4" /> Page settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onHistory}>
              <History className="mr-2 h-4 w-4" /> Version history
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSchedule}>
              <CalendarClock className="mr-2 h-4 w-4" /> Schedule publish
            </DropdownMenuItem>
            {onOpenFind && (
              <DropdownMenuItem onClick={onOpenFind}>
                <Search className="mr-2 h-4 w-4" /> Find & replace
              </DropdownMenuItem>
            )}
            {onToggleCommentMode && (
              <DropdownMenuItem onClick={onToggleCommentMode}>
                <MessageSquare className="mr-2 h-4 w-4" />
                {commentMode ? "Exit comment mode" : "Comment mode"}
              </DropdownMenuItem>
            )}
            {onOpenComments && (
              <DropdownMenuItem onClick={onOpenComments}>
                <MessageSquare className="mr-2 h-4 w-4 opacity-60" /> Comments panel
              </DropdownMenuItem>
            )}
            <DropdownMenuCheckboxItem checked={showA11yMarkers} onCheckedChange={() => toggleA11yMarkers()}>
              <CircleAlert className="mr-2 h-4 w-4" />
              {showA11yMarkers ? "Hide a11y hints" : "Show a11y hints"}
            </DropdownMenuCheckboxItem>
            {onOpenHelp && (
              <DropdownMenuItem onClick={onOpenHelp} className="sm:hidden">
                <HelpCircle className="mr-2 h-4 w-4" /> Help center
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="md:hidden" />
            <DropdownMenuCheckboxItem checked={showRulers} onCheckedChange={() => toggleRulers()} className="md:hidden">
              <Ruler className="mr-2 h-4 w-4" />
              {showRulers ? "Hide rulers" : "Show rulers"}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showGridOverlay} onCheckedChange={() => toggleGridOverlay()} className="md:hidden">
              <Grid3x3 className="mr-2 h-4 w-4" />
              {showGridOverlay ? "Hide grid" : "Show grid"}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={responsiveCompare} onCheckedChange={() => toggleResponsiveCompare()} className="md:hidden">
              <Columns2 className="mr-2 h-4 w-4" />
              {responsiveCompare ? "Hide compare" : "Responsive compare"}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showResponsiveMarkers} onCheckedChange={() => toggleResponsiveMarkers()} className="md:hidden">
              <Tablet className="mr-2 h-4 w-4" />
              {showResponsiveMarkers ? "Hide markers" : "Responsive markers"}
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator className="sm:hidden" />
            <DropdownMenuItem
              disabled={!canUndo}
              onClick={() => actions.history.undo()}
              className="sm:hidden"
            >
              <Undo2 className="mr-2 h-4 w-4" /> Undo
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canRedo}
              onClick={() => actions.history.redo()}
              className="sm:hidden"
            >
              <Redo2 className="mr-2 h-4 w-4" /> Redo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

const SaveIndicator: React.FC<{ state: SaveState; hasUnsavedEdits: boolean }> = ({
  state,
  hasUnsavedEdits,
}) => {
  if (state === "saving")
    return (
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </span>
    );
  if (state === "error")
    return (
      <span className="flex items-center gap-1 text-[11px] text-destructive">
        <CircleAlert className="h-3 w-3" /> Save failed
      </span>
    );
  if (hasUnsavedEdits)
    return <span className="text-[11px] text-amber-600">Unsaved changes</span>;
  if (state === "saved")
    return (
      <span className="flex items-center gap-1 text-[11px] text-emerald-600">
        <Check className="h-3 w-3" /> Saved
      </span>
    );
  return <span className="text-[11px] text-muted-foreground">All changes saved</span>;
};
