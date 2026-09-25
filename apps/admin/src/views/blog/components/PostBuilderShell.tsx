import * as React from "react";
import { useNavigate } from "react-router";
import { toast } from "@/components/ui/toaster";
import { useConfirm } from "@/components/ui/confirm-provider";
import {
  PUBLISH_CONFIRM_DESCRIPTION,
  PUBLISH_CONFIRM_LABEL,
} from "@/components/ui/confirm-labels";
import { LeftSidebar } from "@/views/builder/components/LeftSidebar";
import { Canvas } from "@/views/builder/components/Canvas";
import { PropertyPanel } from "@/views/builder/property/PropertyPanel";
import { useEditorShortcuts } from "@/views/builder/hooks/useEditorShortcuts";
import { useEditorUiStore } from "@/views/builder/store/editorUiStore";
import { useEditLock } from "@/views/builder/lock/useEditLock";
import { EditLockBanner } from "@/views/builder/lock/EditLockBanner";
import { PostBuilderToolbar } from "./PostBuilderToolbar";
import { PostSettingsDialog } from "./PostSettingsDialog";
import { usePostAutosave } from "../hooks/usePostAutosave";
import { usePublishPost } from "../hooks/useBlog";
import { createPostPreviewLinkRequest } from "../api/blog.api";
import type { PostStatus } from "../types";

/**
 * The visual post-builder workspace — MUST render inside <Editor>. Wires the same
 * Canvas/LeftSidebar/PropertyPanel/shortcuts as the page builder, but autosaves to
 * the post's draft layout (PUT /posts/:id/layout). Settings (meta/SEO/taxonomy) and
 * Publish live in the toolbar.
 */
interface PostBuilderShellProps {
  siteId: string | null;
  postId: string;
  title: string;
  status: PostStatus;
  initialJson: string | null;
}

export const PostBuilderShell: React.FC<PostBuilderShellProps> = ({
  siteId,
  postId,
  title,
  status,
  initialJson,
}) => {
  const navigate = useNavigate();
  const { state: saveState, saveNow } = usePostAutosave(postId);
  const publish = usePublishPost();
  const confirm = useConfirm();
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const rightPanelCollapsed = useEditorUiStore((s) => s.rightPanelCollapsed);
  useEditorShortcuts();
  // CONTENT-OPS — advisory concurrent-edit lock (acquire/heartbeat/release).
  const lock = useEditLock("posts", postId, !!postId);

  const onPublish = async (): Promise<void> => {
    const ok = await confirm({
      title: title ? `Publish "${title}"?` : "Publish this post?",
      description: PUBLISH_CONFIRM_DESCRIPTION,
      confirmLabel: PUBLISH_CONFIRM_LABEL,
    });
    if (!ok) return;
    saveNow();
    try {
      await publish.mutateAsync(postId);
      toast.success("Post published");
    } catch {
      toast.error("Publish failed — make sure the post has content");
    }
  };

  // CONTENT-OPS — mint + copy a shareable no-login draft preview link.
  const onCopyPreviewLink = async (): Promise<void> => {
    saveNow();
    try {
      const { url } = await createPostPreviewLinkRequest(postId);
      await navigator.clipboard.writeText(url);
      toast.success("Preview link copied — anyone with it can view the draft");
    } catch {
      toast.error("Could not create preview link");
    }
  };

  return (
    <div className="flex h-screen flex-col">
      {lock.blockedBy ? (
        <EditLockBanner holder={lock.blockedBy} onTakeOver={lock.takeOver} />
      ) : null}
      <PostBuilderToolbar
        title={title}
        status={status}
        saveState={saveState}
        isPublishing={publish.isPending}
        onBack={() => navigate("/blog")}
        onSave={() => {
          saveNow();
          toast.success("Draft saved");
        }}
        onPublish={() => void onPublish()}
        onSettings={() => setSettingsOpen(true)}
        onPreview={() => window.open(`/blog/${postId}/preview`, "_blank")}
        onCopyPreviewLink={() => void onCopyPreviewLink()}
      />
      <div className="flex min-h-0 flex-1">
        <LeftSidebar siteId={siteId} />
        <main className="min-w-0 flex-1">
          <Canvas initialJson={initialJson} />
        </main>
        {!rightPanelCollapsed && (
          <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-card max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:z-40 max-md:max-h-[45vh] max-md:w-full max-md:rounded-t-xl max-md:shadow-xl">
            <PropertyPanel />
          </aside>
        )}
      </div>
      <PostSettingsDialog postId={postId} open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
};
