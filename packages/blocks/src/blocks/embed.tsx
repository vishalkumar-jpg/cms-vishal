import * as React from "react";
import { applyRootBlockStyles } from "../lib";
import { sanitizeEmbedHtml } from "@ob-cms/block-schema";

/* ---- Embed (custom HTML / iframe embeds) ------------------------- */
/**
 * Guard-railed raw-HTML / embed block (Gap A8). Lets marketers paste
 * third-party embed code — YouTube/Vimeo iframes, Calendly, Google Maps,
 * custom markup — onto a page. The pasted HTML is ALWAYS run through
 * `sanitizeEmbedHtml` (allow-list: formatting tags + iframes from a host
 * allowlist with a forced sandbox; `<script>`, event handlers and
 * javascript:/data: URLs are stripped) before being injected via
 * `dangerouslySetInnerHTML`. The component is shared by the builder canvas
 * and the SSR renderer, so sanitization is byte-identical in both (parity).
 * SSR-safe: no `window`/`document` access at module load or render.
 */
export const Embed = React.forwardRef<
  HTMLDivElement,
  {
    html?: string;
    styles?: unknown;
  }
>(({ html, styles }, ref) => {
  const clean = sanitizeEmbedHtml(html);
  const resolved = applyRootBlockStyles(styles, { structural: { boxSizing: "border-box" } });
  if (!clean.trim()) {
    return (
      <div
        ref={ref}
        className="cms-embed cms-embed--empty"
        style={applyRootBlockStyles(styles, {
          structural: { boxSizing: "border-box", textAlign: "center" },
          defaults: {
            padding: 24,
            border: "1px dashed #cbd5e1",
            borderRadius: 8,
            color: "#94a3b8",
            fontSize: 14,
            backgroundColor: "#f8fafc",
          },
        })}
      >
        Add embed code in the panel
      </div>
    );
  }
  return (
    <div
      ref={ref}
      className="cms-embed"
      style={{ maxWidth: "100%", ...resolved }}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
});
Embed.displayName = "Embed";
