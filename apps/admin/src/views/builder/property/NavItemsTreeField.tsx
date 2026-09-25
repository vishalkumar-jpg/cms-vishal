import * as React from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { NavMegaColumnsField, type NavMegaColumnValue } from "./NavMegaColumnsField";
import { PagePickerField } from "./PagePickerField";

type NavItemType = "link" | "dropdown" | "mega";

export interface NavItemTreeValue {
  label?: string;
  url?: string;
  items?: Array<{ label?: string; url?: string }>;
  menuColumns?: NavMegaColumnValue[];
}

interface NavItemsTreeFieldProps {
  value: unknown;
  onChange: (v: NavItemTreeValue[]) => void;
}

const itemType = (item: NavItemTreeValue): NavItemType => {
  if (item.menuColumns !== undefined) return "mega";
  if (item.items !== undefined) return "dropdown";
  return "link";
};

const emptyItem = (type: NavItemType = "link"): NavItemTreeValue => {
  if (type === "mega") return { label: "New mega menu", menuColumns: [] };
  if (type === "dropdown") return { label: "New dropdown", items: [] };
  return { label: "New link", url: "/" };
};

export const NavItemsTreeField: React.FC<NavItemsTreeFieldProps> = ({ value, onChange }) => {
  const items = Array.isArray(value) ? (value as NavItemTreeValue[]) : [];

  const setItem = (idx: number, patch: Partial<NavItemTreeValue>): void => {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const setType = (idx: number, type: NavItemType): void => {
    const label = items[idx]?.label ?? "";
    if (type === "link") setItem(idx, { label, url: items[idx]?.url ?? "/", items: undefined, menuColumns: undefined });
    if (type === "dropdown") setItem(idx, { label, url: items[idx]?.url, items: items[idx]?.items ?? [], menuColumns: undefined });
    if (type === "mega") setItem(idx, { label, url: undefined, items: undefined, menuColumns: items[idx]?.menuColumns ?? [] });
  };

  const move = (idx: number, dir: -1 | 1): void => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const setDropdownLink = (itemIdx: number, linkIdx: number, key: "label" | "url", v: string): void => {
    const item = items[itemIdx];
    const sub = [...(item.items ?? [])];
    sub[linkIdx] = { ...sub[linkIdx], [key]: v };
    setItem(itemIdx, { items: sub });
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-2">
      <div className="flex items-center justify-between">
        <Label>Navigation items</Label>
        <span className="text-[11px] text-muted-foreground">{items.length} items</span>
      </div>
      {items.map((item, idx) => {
        const type = itemType(item);
        return (
          <div key={idx} className="flex flex-col gap-2 rounded-md bg-muted/40 p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{item.label || `Item ${idx + 1}`}</span>
              <div className="flex gap-0.5">
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label="Move item up" onClick={() => move(idx, -1)}>
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label="Move item down" onClick={() => move(idx, 1)}>
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" aria-label="Remove item" onClick={() => onChange(items.filter((_, i) => i !== idx))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Type</Label>
              <Select value={type} onValueChange={(v) => setType(idx, v as NavItemType)}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">Simple link</SelectItem>
                  <SelectItem value="dropdown">Dropdown</SelectItem>
                  <SelectItem value="mega">Mega menu</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Label</Label>
              <Input className="h-8" value={item.label ?? ""} onChange={(e) => setItem(idx, { label: e.target.value })} />
            </div>
            {type !== "mega" ? (
              <PagePickerField
                label={type === "dropdown" ? "Parent link (optional)" : "Link"}
                value={item.url ?? ""}
                onChange={(v) => setItem(idx, { url: v })}
              />
            ) : null}
            {type === "dropdown" ? (
              <div className="flex flex-col gap-1.5 border-t border-border/60 pt-2">
                <Label className="text-[11px]">Dropdown links</Label>
                {(item.items ?? []).map((sub, si) => (
                  <div key={si} className="grid gap-1 rounded border border-border/50 bg-background p-2">
                    <div className="flex justify-end">
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setItem(idx, { items: (item.items ?? []).filter((_, i) => i !== si) })}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <Input className="h-8" placeholder="Label" value={sub.label ?? ""} onChange={(e) => setDropdownLink(idx, si, "label", e.target.value)} />
                    <PagePickerField
                      label="Link"
                      value={sub.url ?? ""}
                      onChange={(v) => setDropdownLink(idx, si, "url", v)}
                    />
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setItem(idx, { items: [...(item.items ?? []), { label: "", url: "" }] })}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add dropdown link
                </Button>
              </div>
            ) : null}
            {type === "mega" ? (
              <NavMegaColumnsField
                label="Mega menu columns"
                value={item.menuColumns}
                onChange={(cols) => setItem(idx, { menuColumns: cols })}
              />
            ) : null}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, emptyItem("link")])}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add link
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, emptyItem("dropdown")])}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add dropdown
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, emptyItem("mega")])}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add mega menu
        </Button>
      </div>
    </div>
  );
};
