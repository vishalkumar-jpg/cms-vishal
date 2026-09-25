import * as React from "react";
import { Code2 } from "lucide-react";
import { Label } from "@/components/ui";
import { Textarea } from "@/components/ui/textarea";
import { NODE_SCOPE_ATTR } from "@ob-cms/block-schema";
import { useUpdateProp } from "./useUpdateProp";
import { BulkStyleBar } from "./BulkStyleBar";

/**
 * Advanced authoring — per-node custom CSS scoped via `[data-ob-node]`.
 */
export const AdvancedControls: React.FC<{
  nodeId: string;
  styles: Record<string, unknown>;
  blockName?: string | null;
}> = ({ nodeId, styles, blockName }) => {
  const update = useUpdateProp(nodeId);
  const value = typeof styles.customCss === "string" ? styles.customCss : "";
  const linkPlaceholder =
    blockName === "Link"
      ? `/* Scoped to this link block */\n& a {\n  text-decoration: none;\n  font-weight: 600;\n}\n\n& a:hover {\n  color: #0a5fd4;\n}`
      : `/* Scoped to this block only */\n& {\n  border-radius: 12px;\n}\n\n.title {\n  letter-spacing: 0.05em;\n}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Code2 className="h-4 w-4 text-muted-foreground" />
        Advanced
      </div>

      <BulkStyleBar nodeId={nodeId} rootPath="styles" />

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Extra styling (for experts)</Label>
        <Textarea
          value={value}
          rows={14}
          spellCheck={false}
          className="font-mono text-[11px] leading-relaxed"
          placeholder={linkPlaceholder}
          onChange={(e) => update("styles.customCss", e.target.value ? e.target.value : undefined)}
        />
        <p className="text-[11px] leading-snug text-muted-foreground">
          Write CSS that applies only to this block — it won&apos;t affect the rest of the page.
          Rules are automatically scoped with{" "}
          <code className="rounded bg-muted px-1 text-[10px]">[{NODE_SCOPE_ATTR}=&quot;…&quot;]</code>.
          Use <code className="rounded bg-muted px-1 text-[10px]">&amp;</code> to target this block&apos;s
          root element.
        </p>
      </div>
    </div>
  );
};
