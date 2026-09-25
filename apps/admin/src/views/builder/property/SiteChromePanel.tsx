import * as React from "react";
import { Label, Switch } from "@/components/ui";
import { BuilderTip } from "../components/BuilderTip";
import { useUpdateProp } from "./useUpdateProp";

const TOPBAR_BACKGROUNDS = new Set(["#147eff", "#147EFF", "rgb(20, 126, 255)"]);

/** Blue announcement strip above the navbar (Section or Topbar block). */
export const isChromeTopbarSection = (props: Record<string, unknown>): boolean => {
  const className = String(props.className ?? "");
  if (className.includes("ob-site-topbar")) return true;
  const styles = props.styles as Record<string, unknown> | undefined;
  const colors = styles?.colors as Record<string, unknown> | undefined;
  const bg = String(colors?.backgroundColor ?? "").trim();
  return TOPBAR_BACKGROUNDS.has(bg);
};

const patchClassName = (className: string, sticky: boolean): string | undefined => {
  const parts = new Set(className.split(/\s+/).filter(Boolean));
  parts.add("ob-site-topbar");
  if (sticky) parts.add("ob-site-topbar--sticky");
  else parts.delete("ob-site-topbar--sticky");
  const next = [...parts].join(" ");
  return next || undefined;
};

/**
 * Sticky / fixed chrome controls for the site header (topbar + navbar).
 * Shown on Content tab — avoids hunting Placement under Layout.
 */
export const SiteChromePanel: React.FC<{
  nodeId: string;
  blockName: string | null;
  props: Record<string, unknown>;
}> = ({ nodeId, blockName, props }) => {
  const update = useUpdateProp(nodeId);
  const isNavbar = blockName === "Navbar";
  const isTopbarBlock = blockName === "Topbar";
  const isTopbarSection = blockName === "Section" && isChromeTopbarSection(props);

  if (!isNavbar && !isTopbarBlock && !isTopbarSection) return null;

  const className = String(props.className ?? "");
  const sticky = isTopbarSection
    ? className.includes("ob-site-topbar--sticky")
    : props.sticky !== false;

  const onStickyChange = (checked: boolean): void => {
    if (isTopbarSection) {
      update("className", patchClassName(className, checked));
      return;
    }
    update("sticky", checked);
  };

  const title = isNavbar ? "Navigation bar" : "Announcement bar";

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Label className="text-xs font-medium">{title}</Label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Keep this bar visible while scrolling on the live site and preview.
          </p>
        </div>
        <BuilderTip content="Sticky chrome is disabled in the builder canvas so it does not cover toolbars. Check Preview to see it.">
          <Switch checked={sticky} onCheckedChange={onStickyChange} aria-label="Stick while scrolling" />
        </BuilderTip>
      </div>
    </div>
  );
};
