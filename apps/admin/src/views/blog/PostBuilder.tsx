import * as React from "react";
import { useParams } from "react-router";
import { Editor } from "@craftjs/core";
import { Loader2 } from "lucide-react";
import { useSiteStore } from "@/store/siteStore";
import { resolver } from "@/views/builder/craft/resolver";
import { layoutToCraft } from "@/views/builder/craft/serialize";
import { PostBuilderShell } from "./components/PostBuilderShell";
import { usePost } from "./hooks/useBlog";

/**
 * Visual Post Builder route (`/blog/:postId/builder`). Loads the post's draft
 * `layout`, deserializes it into Craft node JSON, and mounts the SAME <Editor> +
 * shared-block resolver as the page builder — so a post is authored with the same
 * blocks that ship on the renderer. Autosave PUTs /posts/:id/layout.
 */
export const PostBuilder: React.FC = () => {
  const { postId = null } = useParams();
  const siteId = useSiteStore((s) => s.activeSiteId);
  const { data: post, isLoading, isError } = usePost(postId);

  const initialJson = React.useMemo<string | null>(() => {
    if (!post?.layout) return null;
    try {
      return JSON.stringify(layoutToCraft(post.layout as Parameters<typeof layoutToCraft>[0]));
    } catch {
      return null;
    }
  }, [post?.layout]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Could not load this post. It may not exist or the blog API is unavailable.
      </div>
    );
  }

  return (
    <Editor
      key={post.id}
      resolver={resolver}
      indicator={{ success: "hsl(var(--primary))", error: "#ef4444" }}
    >
      <PostBuilderShell
        siteId={siteId}
        postId={post.id}
        title={post.title}
        status={post.status}
        initialJson={initialJson}
      />
    </Editor>
  );
};
