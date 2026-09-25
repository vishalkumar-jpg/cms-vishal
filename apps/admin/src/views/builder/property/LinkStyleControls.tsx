import * as React from "react";
import { Label, Switch } from "@/components/ui";
import { ColorPickerRow } from "./colorPickerRow";
import { useUpdateProp } from "./useUpdateProp";

/**
 * Quick link appearance controls — underline, color. Full typography and custom
 * CSS live in the Visual / Advanced tabs (`styles`).
 */
export const LinkStyleControls: React.FC<{
  nodeId: string;
  props: Record<string, unknown>;
}> = ({ nodeId, props }) => {
  const update = useUpdateProp(nodeId);
  const linkStyles = (props.linkStyles ?? {}) as Record<string, unknown>;
  const typography = ((props.styles as Record<string, unknown> | undefined)?.typography ??
    {}) as Record<string, unknown>;

  const textDecoration =
    (linkStyles.textDecoration as string | undefined) ??
    (typography.textDecoration as string | undefined) ??
    "underline";
  const underline = textDecoration !== "none";

  const color =
    (linkStyles.color as string | undefined) ??
    (typography.color as string | undefined) ??
    "#147eff";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs font-semibold text-foreground">Link appearance</p>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="link-underline" className="text-xs font-normal">
          Show underline
        </Label>
        <Switch
          id="link-underline"
          checked={underline}
          onCheckedChange={(on) =>
            update("linkStyles.textDecoration", on ? "underline" : "none")
          }
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Link color</Label>
        <ColorPickerRow
          value={color}
          onChange={(v) => update("linkStyles.color", v)}
          ariaLabel="Link color"
          placeholder="#147eff"
        />
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Use the <strong>Visual</strong> tab for font, size, and weight. Use{" "}
        <strong>Advanced → Extra styling</strong> for full CSS (e.g.{" "}
        <code className="rounded bg-muted px-1 text-[10px]">&amp; a {"{ }"}</code>
        ).
      </p>
    </div>
  );
};
