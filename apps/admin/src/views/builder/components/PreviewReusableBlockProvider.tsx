import * as React from "react";
import { useNavigate } from "react-router";
import { migrate } from "@ob-cms/block-schema";
import {
  ReusableBlockContext,
  type ReusableBlockRenderContextValue,
  fetchReusableBlockCached,
} from "@ob-cms/blocks";
import { getReusableBlockRequest } from "@/views/reusable-blocks/api/reusableBlocks.api";

async function loadReusableBlock(id: string) {
  try {
    const block = await getReusableBlockRequest(id);
    const layout = block.layout ? migrate(block.layout) : null;
    const component = layout
      ? {
          layout,
          props: block.props ?? [],
          variants: block.variants ?? [],
          name: block.name,
        }
      : null;
    return { layout, component };
  } catch {
    return { layout: null, component: null };
  }
}

/**
 * Builder-side reusable-block runtime (preview). Provides the
 * `ReusableBlockContext` that `ReusableBlock` instances on the canvas read so a
 * reference previews the actual stored content — WYSIWYG with the published
 * site. Fetches via the admin axios (`GET /reusable-blocks/:id`, site-scoped by
 * the X-Site-Id header). COMPONENTS: `getComponent` returns the full definition
 * (layout + declared props + variants) so a canvas instance previews its
 * variant/overrides/slots through the SAME shared pure resolver as the renderer
 * (editor↔renderer parity).
 */
export const PreviewReusableBlockProvider: React.FC<{
  children: React.ReactNode;
  /** True on the craft canvas; false on draft preview (WYSIWYG with production). */
  editorCanvas?: boolean;
}> = ({ children, editorCanvas = false }) => {
  const navigate = useNavigate();

  const value = React.useMemo<ReusableBlockRenderContextValue>(
    () => ({
      getReusable: async (id) => {
        const { layout } = await fetchReusableBlockCached(id, () => loadReusableBlock(id));
        return layout;
      },
      getComponent: async (id) => {
        const { component } = await fetchReusableBlockCached(id, () => loadReusableBlock(id));
        return component;
      },
      editReusableBlock: (id) => {
        navigate(`/reusable/${id}`);
      },
      editorCanvas,
    }),
    [navigate, editorCanvas],
  );

  return (
    <ReusableBlockContext.Provider value={value}>
      {children}
    </ReusableBlockContext.Provider>
  );
};
