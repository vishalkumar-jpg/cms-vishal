import * as React from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button, Input, Label, Switch } from "@/components/ui";
import { PagePickerField } from "./PagePickerField";

export interface NavMegaColumnValue {
  title?: string;
  url?: string;
  promo?: boolean;
  links?: Array<{ label?: string; url?: string }>;
}

interface NavMegaColumnsFieldProps {
  label?: string;
  value: unknown;
  onChange: (v: NavMegaColumnValue[]) => void;
}

const emptyLink = (): { label: string; url: string } => ({ label: "", url: "" });
const emptyColumn = (): NavMegaColumnValue => ({ title: "", url: "", promo: false, links: [] });

export const NavMegaColumnsField: React.FC<NavMegaColumnsFieldProps> = ({
  label = "Mega menu columns",
  value,
  onChange,
}) => {
  const columns = Array.isArray(value) ? (value as NavMegaColumnValue[]) : [];

  const setColumn = (idx: number, patch: Partial<NavMegaColumnValue>): void => {
    onChange(columns.map((col, i) => (i === idx ? { ...col, ...patch } : col)));
  };

  const moveColumn = (idx: number, dir: -1 | 1): void => {
    const target = idx + dir;
    if (target < 0 || target >= columns.length) return;
    const next = [...columns];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const setLink = (colIdx: number, linkIdx: number, key: "label" | "url", v: string): void => {
    const col = columns[colIdx];
    const links = [...(col.links ?? [])];
    links[linkIdx] = { ...links[linkIdx], [key]: v };
    setColumn(colIdx, { links });
  };

  const addLink = (colIdx: number): void => {
    const col = columns[colIdx];
    setColumn(colIdx, { links: [...(col.links ?? []), emptyLink()] });
  };

  const removeLink = (colIdx: number, linkIdx: number): void => {
    const col = columns[colIdx];
    setColumn(colIdx, { links: (col.links ?? []).filter((_, i) => i !== linkIdx) });
  };

  const moveLink = (colIdx: number, linkIdx: number, dir: -1 | 1): void => {
    const links = [...(columns[colIdx].links ?? [])];
    const target = linkIdx + dir;
    if (target < 0 || target >= links.length) return;
    [links[linkIdx], links[target]] = [links[target], links[linkIdx]];
    setColumn(colIdx, { links });
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-[11px] text-muted-foreground">{columns.length} columns</span>
      </div>
      {columns.map((col, ci) => (
        <div key={ci} className="flex flex-col gap-2 rounded-md bg-muted/40 p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Column {ci + 1}</span>
            <div className="flex gap-0.5">
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label="Move column up" onClick={() => moveColumn(ci, -1)} title="Move up">
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label="Move column down" onClick={() => moveColumn(ci, 1)} title="Move down">
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" aria-label="Remove column" onClick={() => onChange(columns.filter((_, i) => i !== ci))} title="Remove column">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="grid gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Title</Label>
              <Input className="h-8" value={col.title ?? ""} onChange={(e) => setColumn(ci, { title: e.target.value })} />
            </div>
            <PagePickerField
              label="Column link"
              value={col.url ?? ""}
              onChange={(v) => setColumn(ci, { url: v })}
            />
            <div className="flex items-center justify-between">
              <Label className="text-[11px]">Promo cell (Discover More)</Label>
              <Switch checked={!!col.promo} onCheckedChange={(c) => setColumn(ci, { promo: c })} />
            </div>
          </div>
          {!col.promo ? (
            <div className="flex flex-col gap-1.5 border-t border-border/60 pt-2">
              <Label className="text-[11px]">Sub-links</Label>
              {(col.links ?? []).map((link, li) => (
                <div key={li} className="grid gap-1 rounded border border-border/50 bg-background p-2">
                  <div className="flex justify-end gap-0.5">
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveLink(ci, li, -1)}>
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveLink(ci, li, 1)}>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeLink(ci, li)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <Input className="h-8" placeholder="Label" value={link.label ?? ""} onChange={(e) => setLink(ci, li, "label", e.target.value)} />
                  <PagePickerField
                    label="Sub-link"
                    value={link.url ?? ""}
                    onChange={(v) => setLink(ci, li, "url", v)}
                  />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => addLink(ci)}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add sub-link
              </Button>
            </div>
          ) : null}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...columns, emptyColumn()])}>
        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add column
      </Button>
    </div>
  );
};
