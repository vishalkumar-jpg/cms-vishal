import * as React from "react";
import { ImagePlus, Plus, Trash2, ChevronUp, ChevronDown, X } from "lucide-react";
import { Button, Input, Label, Switch } from "@/components/ui";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAssetPickStore } from "../store/assetPickStore";
import type { MediaItem } from "@/views/media/types";
import { useUpdateProp } from "./useUpdateProp";
import { introspectSchema, introspectArrayItem, type FieldSpec } from "./introspect";
import { useEnforcedGuardrails, isPropEditable } from "../guardrails/useGuardrails";
import { PagePickerField } from "./PagePickerField";
import { FormPickerField } from "./FormPickerField";
import { CollectionPickerField } from "./CollectionPickerField";
import { IconPickerField } from "./IconPickerField";
import { FieldBindControl } from "./FieldBindControl";
import { VisibilityControl } from "./VisibilityControl";
import { ComponentPropBindControl } from "./ComponentPropBindControl";
import { SlotMarkerControl } from "./SlotMarkerControl";
import { NavMegaColumnsField } from "./NavMegaColumnsField";
import { NavDropdownLinksField } from "./NavDropdownLinksField";
import type { z } from "zod";

/** Prop kinds that support binding to a collection field (text/url/image/etc.). */
const BINDABLE_KINDS = new Set(["text", "textarea", "url", "image"]);

/**
 * Auto-generated content controls from a block's zod propSchema. Each field maps
 * to a control by its zod type. Updates go straight to the node prop via Craft's
 * setProp, so the canvas reflects edits immediately. Image fields open the shared
 * Media picker; array fields get a structured add/remove/reorder editor.
 */
interface ContentControlsProps {
  nodeId: string;
  blockName?: string | null;
  schema: z.ZodTypeAny | undefined;
  props: Record<string, unknown>;
}

export const ContentControls: React.FC<ContentControlsProps> = ({ nodeId, blockName, schema, props }) => {
  const update = useUpdateProp(nodeId);
  const fields = React.useMemo(() => introspectSchema(schema), [schema]);
  // GUARDRAILS: when constraints are enforced for this user, hide locked props.
  const enforced = useEnforcedGuardrails(nodeId);
  const hiddenNavbarFields = new Set(["navItems", "links", "autoLinks", "useObTemplate", "sticky"]);
  const visibleFields = fields.filter((f) => {
    if (!isPropEditable(enforced, f.name)) return false;
    if (blockName === "Navbar" && hiddenNavbarFields.has(f.name)) return false;
    if (blockName === "Topbar" && f.name === "sticky") return false;
    return true;
  });
  const someHiddenByGuardrails = fields.some((f) => !isPropEditable(enforced, f.name));

  return (
    <div className="flex flex-col gap-3">
      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground">This block has no editable content props.</p>
      ) : null}
      {someHiddenByGuardrails && (
        <p className="rounded-md border border-amber-300/60 bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          Some content is locked by brand guardrails.
        </p>
      )}
      {visibleFields.map((field) => (
        <div key={field.name} className="flex flex-col">
          <ContentField
            blockName={blockName}
            field={field}
            schema={schema}
            value={props[field.name]}
            onChange={(v) => update(field.name, v)}
            onPickImage={(item) => applyMediaItem(update, item)}
          />
          {/* "⛓ bind" affordance: only on bindable props, and only renders when
              the node is inside a Repeater (else it returns null). */}
          {BINDABLE_KINDS.has(field.kind) ? (
            <FieldBindControl nodeId={nodeId} propName={field.name} />
          ) : null}
          {/* "⚙ use prop" affordance: only in the component editor; binds the
              node prop to a declared component prop (else returns null). */}
          {BINDABLE_KINDS.has(field.kind) ? (
            <ComponentPropBindControl nodeId={nodeId} propName={field.name} />
          ) : null}
        </div>
      ))}
      {/* Node-level conditional visibility (locale / authenticated / field). */}
      <VisibilityControl nodeId={nodeId} />
      {/* COMPONENTS: mark this node as a named editable Slot (component editor only). */}
      <SlotMarkerControl nodeId={nodeId} />
    </div>
  );
};

/**
 * Capture a picked MediaItem's responsive metadata onto the Image block's
 * companion props (variants / intrinsic dimensions / focal point) so the
 * published <img> is self-contained — no renderer fetch, SSR/parity-safe.
 * Each field is cleared when the media item lacks it (e.g. a freshly-uploaded
 * image still being processed → empty variants), so stale data never lingers.
 */
const applyMediaItem = (
  update: (path: string, value: unknown) => void,
  item: MediaItem,
): void => {
  update("variants", Array.isArray(item.variants) && item.variants.length ? item.variants : undefined);
  update("intrinsicWidth", typeof item.width === "number" ? item.width : undefined);
  update("intrinsicHeight", typeof item.height === "number" ? item.height : undefined);
  update("focalPoint", item.focalPoint ?? undefined);
  // Auto-fill alt text from the asset's stored alt when the block has none yet.
  if (item.alt) update("altText", item.alt);
};

const ContentField: React.FC<{
  blockName?: string | null;
  field: FieldSpec;
  schema: z.ZodTypeAny | undefined;
  value: unknown;
  onChange: (v: unknown) => void;
  onPickImage?: (item: MediaItem) => void;
}> = ({ blockName, field, schema, value, onChange, onPickImage }) => {
  const id = `field-${field.name}`;

  if (blockName === "Nav Mega" && field.name === "columns") {
    return <NavMegaColumnsField label={field.label} value={value} onChange={onChange as (v: unknown[]) => void} />;
  }

  if (blockName === "Nav Dropdown" && field.name === "items") {
    return <NavDropdownLinksField label={field.label} value={value} onChange={onChange as (v: unknown[]) => void} />;
  }

  if (field.kind === "boolean") {
    return (
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{field.label}</Label>
        <Switch id={id} checked={!!value} onCheckedChange={(c) => onChange(c)} />
      </div>
    );
  }

  if (field.kind === "image") {
    return (
      <ImageField
        label={field.label}
        value={value ? String(value) : ""}
        onChange={onChange}
        onPick={onPickImage}
      />
    );
  }

  if (field.kind === "icon") {
    return <IconPickerField label={field.label} value={value ? String(value) : ""} onChange={onChange} />;
  }

  if (field.kind === "url") {
    return (
      <PagePickerField
        label={field.label}
        value={value === undefined || value === null ? "" : String(value)}
        onChange={onChange}
      />
    );
  }

  if (field.kind === "form") {
    return (
      <FormPickerField
        label={field.label}
        value={value === undefined || value === null ? "" : String(value)}
        onChange={onChange}
      />
    );
  }

  if (field.kind === "collection") {
    return (
      <CollectionPickerField
        label={field.label}
        value={value === undefined || value === null ? "" : String(value)}
        onChange={onChange}
      />
    );
  }

  if (field.kind === "array") {
    return <ArrayField field={field} schema={schema} value={value} onChange={onChange} />;
  }

  if (field.kind === "select" && field.options) {
    return (
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>{field.label}</Label>
        <Select value={value ? String(value) : undefined} onValueChange={(v) => onChange(v)}>
          <SelectTrigger id={id} className="h-9">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.kind === "html") {
    return (
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>{field.label}</Label>
        <Textarea
          id={id}
          className="font-mono text-[11px] min-h-[140px]"
          placeholder="Paste embed code, e.g. <iframe src=&quot;https://www.youtube.com/embed/…&quot;></iframe>"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
        <p className="text-[11px] text-muted-foreground">
          Embeds are sanitized: iframes from trusted hosts (YouTube, Vimeo, Calendly, HubSpot,
          Google Maps/Forms, Loom, Spotify, Typeform…) are allowed with a forced sandbox.
          &lt;script&gt; tags and inline event handlers are stripped.
        </p>
      </div>
    );
  }

  if (field.kind === "textarea") {
    return (
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>{field.label}</Label>
        <Textarea
          id={id}
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (field.kind === "json") {
    return (
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>{field.label}</Label>
        <Textarea
          id={id}
          className="font-mono text-[11px]"
          defaultValue={value === undefined ? "" : JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              onChange(e.target.value ? JSON.parse(e.target.value) : undefined);
            } catch {
              /* keep typing; ignore parse errors until valid */
            }
          }}
        />
      </div>
    );
  }

  if (field.kind === "number") {
    return (
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>{field.label}</Label>
        <Input
          id={id}
          type="number"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      </div>
    );
  }

  // text / url / color (color falls back to a text/native picker here)
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{field.label}</Label>
      <Input
        id={id}
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};

/** Image input: text URL + a button that opens the left Assets panel. */
export const ImageField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  /**
   * Fired with the full chosen MediaItem so the caller can capture responsive
   * metadata (variants/dimensions/focalPoint) alongside the URL. Pasting a raw
   * URL into the input only calls `onChange` — no item — so external images
   * gracefully render as a plain <img>.
   */
  onPick?: (item: MediaItem) => void;
}> = ({ label, value, onChange, onPick }) => {
  const openAssetPick = useAssetPickStore((s) => s.open);
  const pick = async (): Promise<void> => {
    const item = await openAssetPick("image");
    if (item?.url) {
      onChange(item.url);
      onPick?.(item);
    }
  };
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {value ? (
        <div className="relative h-24 overflow-hidden rounded-md border border-border">
          <img src={value} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white hover:bg-black/80"
            title="Remove"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : null}
      <div className="flex gap-1">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Image URL" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => void pick()}
          title="Browse assets"
        >
          <ImagePlus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

/**
 * Structured array editor: renders each item as a row of its sub-fields with
 * add / remove / move up-down. Falls back to a JSON textarea when the element
 * shape can't be introspected (e.g. union/string arrays).
 */
const ArrayField: React.FC<{
  field: FieldSpec;
  schema: z.ZodTypeAny | undefined;
  value: unknown;
  onChange: (v: unknown) => void;
}> = ({ field, schema, value, onChange }) => {
  const itemSpec = React.useMemo(
    () => introspectArrayItem(schema, field.name),
    [schema, field.name],
  );
  const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];

  if (!itemSpec) {
    return (
      <div className="flex flex-col gap-1">
        <Label>{field.label}</Label>
        <Textarea
          className="font-mono text-[11px]"
          defaultValue={value === undefined ? "" : JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              onChange(e.target.value ? JSON.parse(e.target.value) : undefined);
            } catch {
              /* ignore until valid */
            }
          }}
        />
      </div>
    );
  }

  const setItem = (idx: number, key: string, v: unknown): void => {
    const next = items.map((it, i) => (i === idx ? { ...it, [key]: v } : it));
    onChange(next);
  };
  const move = (idx: number, dir: -1 | 1): void => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };
  const remove = (idx: number): void => onChange(items.filter((_, i) => i !== idx));
  const add = (): void => onChange([...items, itemSpec.makeDefault()]);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-2">
      <div className="flex items-center justify-between">
        <Label>{field.label}</Label>
        <span className="text-[11px] text-muted-foreground">{items.length} items</span>
      </div>
      {items.map((item, idx) => (
        <div key={idx} className="flex flex-col gap-1.5 rounded-md bg-muted/40 p-2">
          <div className="flex items-center justify-end gap-0.5">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(idx, -1)} title="Move up">
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => move(idx, 1)} title="Move down">
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive"
              onClick={() => remove(idx)}
              title="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          {itemSpec.fields.map((sub) => (
            <ItemSubField
              key={sub.name}
              field={sub}
              value={item[sub.name]}
              onChange={(v) => setItem(idx, sub.name, v)}
            />
          ))}
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add item
      </Button>
    </div>
  );
};

/** A single primitive sub-field inside an array item row. */
const ItemSubField: React.FC<{
  field: FieldSpec;
  value: unknown;
  onChange: (v: unknown) => void;
}> = ({ field, value, onChange }) => {
  if (field.kind === "boolean") {
    return (
      <div className="flex items-center justify-between">
        <Label className="text-[11px]">{field.label}</Label>
        <Switch checked={!!value} onCheckedChange={(c) => onChange(c)} />
      </div>
    );
  }
  if (field.kind === "image") {
    return <ImageField label={field.label} value={value ? String(value) : ""} onChange={onChange} />;
  }
  if (field.kind === "url") {
    return (
      <PagePickerField
        label={field.label}
        value={value === undefined || value === null ? "" : String(value)}
        onChange={onChange}
      />
    );
  }
  if (field.kind === "select" && field.options) {
    return (
      <div className="flex flex-col gap-0.5">
        <Label className="text-[11px]">{field.label}</Label>
        <Select value={value ? String(value) : undefined} onValueChange={(v) => onChange(v)}>
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (field.kind === "number") {
    return (
      <div className="flex flex-col gap-0.5">
        <Label className="text-[11px]">{field.label}</Label>
        <Input
          className="h-8"
          type="number"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      <Label className="text-[11px]">{field.label}</Label>
      <Input
        className="h-8"
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};
