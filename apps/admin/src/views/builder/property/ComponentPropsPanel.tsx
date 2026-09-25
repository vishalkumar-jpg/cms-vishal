import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { ComponentProp, ComponentPropType, ComponentVariant } from "@ob-cms/block-schema";
import { Button, Input, Label } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useComponentEditor } from "./ComponentEditorContext";

/**
 * COMPONENTS — the Props + Variants authoring panel for the component (reusable-
 * block) editor. Lets the author declare typed editable props (key/label/type/
 * default) and named variants (prop-presets). Reads/writes the shared
 * `ComponentEditorContext`, which the reusable-block editor shell persists
 * alongside the layout. Renders nothing in the page builder (no context).
 */
const PROP_TYPES: ComponentPropType[] = [
  "text",
  "richtext",
  "number",
  "boolean",
  "color",
  "image",
  "url",
  "select",
];

export const ComponentPropsPanel: React.FC = () => {
  const editor = useComponentEditor();
  if (!editor) return null;
  const { props, setProps, variants, setVariants } = editor;

  const updateProp = (idx: number, patch: Partial<ComponentProp>): void =>
    setProps(props.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  const addProp = (): void =>
    setProps([...props, { key: `prop${props.length + 1}`, label: "", type: "text", default: "" }]);
  const removeProp = (idx: number): void => setProps(props.filter((_, i) => i !== idx));

  const updateVariant = (idx: number, patch: Partial<ComponentVariant>): void =>
    setVariants(variants.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  const addVariant = (): void =>
    setVariants([...variants, { name: `variant${variants.length + 1}`, label: "", values: {} }]);
  const removeVariant = (idx: number): void => setVariants(variants.filter((_, i) => i !== idx));

  return (
    <div className="flex flex-col gap-4 p-4">
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Component Props</h3>
          <Button size="sm" variant="outline" onClick={addProp}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </div>
        {props.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Declare editable props, then bind a node’s text/url/image to one with “⚙ use prop”.
          </p>
        ) : null}
        {props.map((p, idx) => (
          <div key={idx} className="flex flex-col gap-1.5 rounded-md border border-border p-2">
            <div className="flex items-center gap-1.5">
              <Input
                className="h-7 text-xs"
                value={p.key}
                placeholder="key"
                onChange={(e) => updateProp(idx, { key: e.target.value })}
              />
              <Select
                value={p.type}
                onValueChange={(v) => updateProp(idx, { type: v as ComponentPropType })}
              >
                <SelectTrigger className="h-7 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROP_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive"
                onClick={() => removeProp(idx)}
                title="Remove prop"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Input
              className="h-7 text-xs"
              value={p.label ?? ""}
              placeholder="Label (shown to editors)"
              onChange={(e) => updateProp(idx, { label: e.target.value })}
            />
            <div className="flex flex-col gap-0.5">
              <Label className="text-[10px] text-muted-foreground">Default</Label>
              {p.type === "boolean" ? (
                <Select
                  value={String(!!p.default)}
                  onValueChange={(v) => updateProp(idx, { default: v === "true" })}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">true</SelectItem>
                    <SelectItem value="false">false</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="h-7 text-xs"
                  type={p.type === "number" ? "number" : "text"}
                  value={p.default === undefined || p.default === null ? "" : String(p.default)}
                  placeholder="Default value"
                  onChange={(e) =>
                    updateProp(idx, {
                      default:
                        p.type === "number"
                          ? e.target.value === ""
                            ? undefined
                            : Number(e.target.value)
                          : e.target.value,
                    })
                  }
                />
              )}
            </div>
            {p.type === "select" ? (
              <Input
                className="h-7 text-xs"
                value={(p.options ?? []).join(", ")}
                placeholder="Options (comma-separated)"
                onChange={(e) =>
                  updateProp(idx, {
                    options: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            ) : null}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Variants</h3>
          <Button size="sm" variant="outline" onClick={addVariant} disabled={props.length === 0}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </div>
        {variants.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Optional named prop-presets. An instance can pick one to apply the preset values.
          </p>
        ) : null}
        {variants.map((v, idx) => (
          <div key={idx} className="flex flex-col gap-1.5 rounded-md border border-border p-2">
            <div className="flex items-center gap-1.5">
              <Input
                className="h-7 text-xs"
                value={v.name}
                placeholder="name"
                onChange={(e) => updateVariant(idx, { name: e.target.value })}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive"
                onClick={() => removeVariant(idx)}
                title="Remove variant"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {props.map((p) => (
              <div key={p.key} className="flex items-center gap-1.5">
                <Label className="w-20 shrink-0 truncate text-[10px] text-muted-foreground">
                  {p.label || p.key}
                </Label>
                <Input
                  className="h-7 text-xs"
                  value={
                    v.values[p.key] === undefined || v.values[p.key] === null
                      ? ""
                      : String(v.values[p.key])
                  }
                  placeholder="(default)"
                  onChange={(e) =>
                    updateVariant(idx, {
                      values: {
                        ...v.values,
                        [p.key]:
                          p.type === "number"
                            ? e.target.value === ""
                              ? undefined
                              : Number(e.target.value)
                            : p.type === "boolean"
                              ? e.target.value === "true"
                              : e.target.value,
                      },
                    })
                  }
                />
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
};
