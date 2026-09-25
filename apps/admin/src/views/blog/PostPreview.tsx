import * as React from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Monitor, Tablet, Smartphone, ExternalLink, Loader2 } from "lucide-react";
import { RenderLayout, blockRegistry, OBSiteRoot } from "@ob-cms/blocks";
import { migrate } from "@ob-cms/block-schema";
import "@ob-cms/blocks/blocks.css";
import { Button } from "@/components/ui";
import { useActiveSite } from "@/views/sites/hooks/useSites";
import { useTheme } from "@/views/theme/hooks/useTheme";
import { themeTokensToCanvasVars } from "@/views/builder/craft/themeVars";
import { siteOriginUrl } from "@/views/builder/lib/siteUrl";
import { usePost } from "./hooks/useBlog";

/**
 * Full-screen DRAFT post preview (`/blog/:postId/preview`) — the post twin of the
 * page `Preview`. Renders the post's unpublished `layout` through the SAME
 * `RenderLayout` + blocks the public renderer uses, with the active site's theme.
 */
const DEVICES = [
  { key: "desktop", label: "Desktop", icon: Monitor, width: 0 },
  { key: "tablet", label: "Tablet", icon: Tablet, width: 768 },
  { key: "mobile", label: "Mobile", icon: Smartphone, width: 390 },
] as const;

type DeviceKey = (typeof DEVICES)[number]["key"];

export const PostPreview: React.FC = () => {
  const { postId = null } = useParams();
  const navigate = useNavigate();
  const { activeSite } = useActiveSite();
  const { data: post, isLoading, isError } = usePost(postId);
  const { data: theme } = useTheme();
  const [device, setDevice] = React.useState<DeviceKey>("desktop");

  const themeStyle = React.useMemo(
    () => themeTokensToCanvasVars(theme?.tokens),
    [theme?.tokens],
  );

  const layout = React.useMemo(
    () => (post?.layout ? migrate(post.layout) : null),
    [post?.layout],
  );

  const width = DEVICES.find((d) => d.key === device)?.width ?? 0;
  const publicUrl = (() => {
    const origin = siteOriginUrl(activeSite);
    return post && origin ? `${origin}/blog/${post.slug}` : null;
  })();

  return (
    <div className="flex h-screen flex-col bg-muted/40">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/blog/${postId}/builder`)}
            title="Back to editor"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="text-sm font-medium">{post?.title ?? "Preview"}</div>
            <div className="text-xs text-muted-foreground">Draft preview — not yet published</div>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          {DEVICES.map((d) => {
            const Icon = d.icon;
            const active = d.key === device;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => setDevice(d.key)}
                title={d.label}
                className={`flex h-8 w-9 items-center justify-center rounded ${
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {publicUrl && post?.status === "published" ? (
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View published
              </Button>
            </a>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 justify-center overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading preview…
          </div>
        ) : isError || !layout ? (
          <div className="flex items-center text-sm text-muted-foreground">
            Nothing to preview yet — add some blocks in the editor.
          </div>
        ) : (
          <div
            className="h-fit min-h-full bg-white shadow-sm transition-[width] duration-200"
            style={{ width: width ? `${width}px` : "100%", maxWidth: "100%" }}
          >
            <OBSiteRoot viewportMode={device === "desktop" ? undefined : device}>
              <div style={themeStyle}>
                <RenderLayout data={layout} blocks={blockRegistry} wrap={false} repairLegacyLayout />
              </div>
            </OBSiteRoot>
          </div>
        )}
      </div>
    </div>
  );
};
