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
  Eye,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { useEditorUiStore } from "@/views/builder/store/editorUiStore";
import type { Breakpoint } from "@/views/builder/property/styleTokens";
import type { SaveState } from "@/views/builder/hooks/useAutosave";
import type { PostStatus } from "../types";

interface PostBuilderToolbarProps {
  title: string;
  status: PostStatus;
  saveState: SaveState;
  isPublishing: boolean;
  onBack: () => void;
  onSave: () => void;
  onPublish: () => void;
  onSettings: () => void;
  onPreview: () => void;
  /** CONTENT-OPS — copy a shareable no-login draft preview link. */
  onCopyPreviewLink?: () => void;
}

const BREAKPOINTS: { key: Breakpoint; icon: React.ReactNode; label: string }[] = [
  { key: "desktop", icon: <Monitor className="h-4 w-4" />, label: "Desktop" },
  { key: "tablet", icon: <Tablet className="h-4 w-4" />, label: "Tablet" },
  { key: "mobile", icon: <Smartphone className="h-4 w-4" />, label: "Mobile" },
];

const STATUS_VARIANT: Record<PostStatus, BadgeProps["variant"]> = {
  draft: "muted",
  published: "success",
  scheduled: "warning",
  archived: "outline",
};

/**
 * Post-builder header — the post twin of `BuilderToolbar`. Same breakpoint
 * switcher + undo/redo + save indicator, plus Settings (meta/SEO/taxonomy),
 * Preview, Save (draft layout) and Publish.
 */
export const PostBuilderToolbar: React.FC<PostBuilderToolbarProps> = ({
  title,
  status,
  saveState,
  isPublishing,
  onBack,
  onSave,
  onPublish,
  onSettings,
  onPreview,
  onCopyPreviewLink,
}) => {
  const breakpoint = useEditorUiStore((s) => s.breakpoint);
  const setBreakpoint = useEditorUiStore((s) => s.setBreakpoint);
  const { canUndo, canRedo, actions } = useEditor((_, query) => ({
    canUndo: query.history.canUndo(),
    canRedo: query.history.canRedo(),
  }));

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} title="Back to blog">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold leading-none">
            {title || "Untitled post"}
            <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
          </p>
          <SaveIndicator state={saveState} />
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-border p-1">
        {BREAKPOINTS.map((bp) => (
          <button
            key={bp.key}
            type="button"
            title={bp.label}
            onClick={() => setBreakpoint(bp.key)}
            className={cn(
              "flex h-7 w-8 items-center justify-center rounded-md transition-colors",
              breakpoint === bp.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            {bp.icon}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          disabled={!canUndo}
          onClick={() => actions.history.undo()}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={!canRedo}
          onClick={() => actions.history.redo()}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-6 w-px bg-border" />
        <Button variant="ghost" size="icon" onClick={onSettings} title="Post settings, SEO & taxonomy">
          <Settings className="h-4 w-4" />
        </Button>
        <div className="mx-1 h-6 w-px bg-border" />
        <Button variant="outline" size="sm" onClick={onPreview} title="Preview the draft">
          <Eye className="mr-1.5 h-4 w-4" /> Preview
        </Button>
        {onCopyPreviewLink && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCopyPreviewLink}
            title="Copy a shareable no-login preview link"
          >
            <Link2 className="h-4 w-4" />
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onSave}>
          <Save className="mr-1.5 h-4 w-4" /> Save
        </Button>
        <Button size="sm" onClick={onPublish} disabled={isPublishing}>
          {isPublishing ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Rocket className="mr-1.5 h-4 w-4" />
          )}
          Publish
        </Button>
      </div>
    </header>
  );
};

const SaveIndicator: React.FC<{ state: SaveState }> = ({ state }) => {
  if (state === "saving")
    return (
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </span>
    );
  if (state === "saved")
    return (
      <span className="flex items-center gap-1 text-[11px] text-emerald-600">
        <Check className="h-3 w-3" /> Saved
      </span>
    );
  if (state === "error")
    return (
      <span className="flex items-center gap-1 text-[11px] text-destructive">
        <CircleAlert className="h-3 w-3" /> Save failed
      </span>
    );
  return <span className="text-[11px] text-muted-foreground">All changes saved</span>;
};
