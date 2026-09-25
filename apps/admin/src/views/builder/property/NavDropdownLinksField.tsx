import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { PagePickerField } from "./PagePickerField";

interface NavDropdownLinksFieldProps {
  label?: string;
  value: unknown;
  onChange: (v: Array<{ label?: string; url?: string }>) => void;
}

/** Flat dropdown link list — used by Nav Dropdown blocks and nested menus. */
export const NavDropdownLinksField: React.FC<NavDropdownLinksFieldProps> = ({
  label = "Dropdown links",
  value,
  onChange,
}) => {
  const links = Array.isArray(value) ? (value as Array<{ label?: string; url?: string }>) : [];

  const setLink = (idx: number, key: "label" | "url", v: string): void => {
    onChange(links.map((link, i) => (i === idx ? { ...link, [key]: v } : link)));
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-[11px] text-muted-foreground">{links.length} links</span>
      </div>
      {links.map((link, idx) => (
        <div key={idx} className="grid gap-1 rounded border border-border/50 bg-background p-2">
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive"
              aria-label="Remove link"
              onClick={() => onChange(links.filter((_, i) => i !== idx))}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          <Input
            className="h-8"
            placeholder="Label"
            value={link.label ?? ""}
            onChange={(e) => setLink(idx, "label", e.target.value)}
          />
          <PagePickerField
            label="Link"
            value={link.url ?? ""}
            onChange={(v) => setLink(idx, "url", v)}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...links, { label: "", url: "" }])}
      >
        <Plus className="mr-1 h-3.5 w-3.5" /> Add link
      </Button>
    </div>
  );
};
