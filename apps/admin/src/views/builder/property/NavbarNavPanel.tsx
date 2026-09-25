import * as React from "react";
import { useEditor } from "@craftjs/core";
import { OB_NAV_ITEMS } from "@ob-cms/blocks";
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { useUpdateProp } from "./useUpdateProp";
import { NavItemsTreeField } from "./NavItemsTreeField";

interface NavbarNavPanelProps {
  nodeId: string;
  props: Record<string, unknown>;
}

/**
 * Primary navbar menu editor — legacy navItems tree (links, dropdowns, mega menus).
 */
export const NavbarNavPanel: React.FC<NavbarNavPanelProps> = ({ nodeId, props }) => {
  const update = useUpdateProp(nodeId);
  const { query } = useEditor();
  const mode = (props.mode as string | undefined) ?? "legacy";
  const navItems = props.navItems;
  const items = Array.isArray(navItems) ? navItems : [];
  let hasChildren = false;
  try {
    hasChildren = (query.node(nodeId).get().data.nodes?.length ?? 0) > 0;
  } catch {
    /* node not mounted */
  }

  const loadObMenu = (): void => {
    update("navItems", structuredClone(OB_NAV_ITEMS));
    update("mode", "legacy");
  };

  if (mode === "composed" && hasChildren) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">Composed navigation</p>
        <p className="mt-1">
          This navbar uses child blocks (Nav Link, Nav Dropdown, Nav Mega). Select each item in the
          layers tree to edit its label, URL, dropdown links, or mega columns.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => update("mode", "legacy")}
        >
          Switch to menu list editor
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-primary/30 bg-primary/5 p-3">
      <div>
        <p className="text-xs font-semibold text-foreground">Navigation menu</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Add or edit top-level links, dropdowns, and mega menus. Each dropdown supports multiple
          sub-links; mega menus support columns with links plus an optional promo cell.
        </p>
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Menu editor mode</Label>
        <Select value={mode} onValueChange={(v) => update("mode", v)}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="legacy">Menu list (recommended)</SelectItem>
            <SelectItem value="composed">Composed blocks (advanced)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <NavItemsTreeField
        value={items}
        onChange={(v) => {
          update("navItems", v);
          if (mode !== "legacy") update("mode", "legacy");
        }}
      />

      {items.length === 0 ? (
        <Button type="button" variant="default" size="sm" onClick={loadObMenu}>
          Load Office Beacon live menu
        </Button>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={loadObMenu}>
          Reset to Office Beacon live menu
        </Button>
      )}
    </div>
  );
};
