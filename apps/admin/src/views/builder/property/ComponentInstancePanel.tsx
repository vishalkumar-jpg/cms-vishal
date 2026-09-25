import * as React from "react";
import { useEditor } from "@craftjs/core";
import { Loader2, Pencil } from "lucide-react";
import { useNavigate } from "react-router";
import type { ComponentProp, SerializedLayout } from "@ob-cms/block-schema";
import { collectSlots, layoutHasContent } from "@ob-cms/block-schema";
import { Input, Label, Switch, Button } from "@/components/ui";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSiteStore } from "@/store/siteStore";
import { useReusableBlock } from "@/views/reusable-blocks/hooks/useReusableBlocks";
import { useUpdateProp } from "./useUpdateProp";

/**
 * COMPONENTS — the instance override panel, shown in the page builder's property
 * panel when a `Reusable Block` (component INSTANCE) node is selected. It loads
 * the source component definition and renders:
 *   - a variant picker (writes the `variant` prop),
 *   - one editable field per declared prop (writes `propOverrides[key]`),
 *   - one editor per declared Slot (writes `slotContent[name]`).
 *
 * Changing the source component updates the instance's STRUCTURE on next render;
 * these per-instance overrides are preserved. A plain reusable block (no props/
 * slots) shows just an informational note (backward-compatible).
 */
interface InstanceProps {
  reusableBlockId?: string;
  variant?: string;
  propOverrides?: Record<string, unknown>;
  slotContent?: Record<string, SerializedLayout>;
}

/** Wrap a plain text value as a minimal SerializedLayout (single Paragraph). */
const textToSlotLayout = (text: string): SerializedLayout => ({
  schemaVersion: "2.0",
  root: "ROOT",
  nodes: {
    ROOT: {
      type: { resolvedName: "Paragraph" },
      isCanvas: false,
      props: { text },
      displayName: "Paragraph",
      custom: {},
      parent: null,
      hidden: false,
      nodes: [],
      linkedNodes: {},
    },
  },
});

/** Read the plain text back out of a slot layout (if it's the simple shape). */
const slotLayoutToText = (layout: SerializedLayout | undefined): string => {
  if (!layout) return "";
  const root = layout.nodes?.[layout.root];
  const text = (root?.props as { text?: unknown } | undefined)?.text;
  return typeof text === "string" ? text : "";
};

export const ComponentInstancePanel: React.FC<{ nodeId: string }> = ({ nodeId }) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const navigate = useNavigate();
  const update = useUpdateProp(nodeId);
  const { instanceProps } = useEditor((state) => ({
    instanceProps: (state.nodes[nodeId]?.data.props ?? {}) as InstanceProps,
  }));
  const { reusableBlockId, variant, propOverrides = {}, slotContent = {} } = instanceProps;
  const { data: component, isLoading } = useReusableBlock(siteId, reusableBlockId ?? null);

  if (!reusableBlockId) {
    return (
      <p className="text-xs text-muted-foreground">
        Insert this reference from the Reusable panel to pick a component.
      </p>
    );
  }
  if (isLoading || !component) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading component…
      </div>
    );
  }

  const props = component.props ?? [];
  const variants = component.variants ?? [];
  const slots = collectSlots(component.layout);
  const hasContent = layoutHasContent(component.layout);

  const setOverride = (key: string, value: unknown): void =>
    update("propOverrides", { ...propOverrides, [key]: value });
  const setSlot = (name: string, text: string): void =>
    update("slotContent", {
      ...slotContent,
      [name]: text ? textToSlotLayout(text) : undefined,
    });

  if (props.length === 0 && variants.length === 0 && slots.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-amber-300/60 bg-amber-50 p-3 dark:bg-amber-950/20">
        <p className="text-xs text-amber-900 dark:text-amber-100">
          {hasContent
            ? `“${component.name}” is a plain reusable block (no per-page props). Structure is synced from the source.`
            : `“${component.name}” has no sections yet. Open the reusable editor, add blocks (e.g. hero content), and save.`}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-fit gap-1.5"
          onClick={() => navigate(`/reusable/${reusableBlockId}`)}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit “{component.name}”
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-muted-foreground">
        Instance of <span className="font-medium">{component.name}</span>. Overrides are per-page;
        structure stays synced to the source.
      </p>

      {variants.length > 0 ? (
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Variant</Label>
          <Select
            value={variant ?? "__none"}
            onValueChange={(v) => update("variant", v === "__none" ? undefined : v)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Default</SelectItem>
              {variants.map((v) => (
                <SelectItem key={v.name} value={v.name}>
                  {v.label || v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {props.map((p) => (
        <PropOverrideField
          key={p.key}
          prop={p}
          value={propOverrides[p.key]}
          onChange={(v) => setOverride(p.key, v)}
        />
      ))}

      {slots.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-md border border-border p-2">
          <Label className="text-xs font-semibold">Slots</Label>
          {slots.map((s) => (
            <div key={s.name} className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">{s.name}</Label>
              <Textarea
                className="min-h-[60px] text-xs"
                value={slotLayoutToText(slotContent[s.name])}
                placeholder="Slot content (leave empty to use the component default)"
                onChange={(e) => setSlot(s.name, e.target.value)}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const PropOverrideField: React.FC<{
  prop: ComponentProp;
  value: unknown;
  onChange: (v: unknown) => void;
}> = ({ prop, value, onChange }) => {
  const label = prop.label || prop.key;
  const current = value === undefined ? prop.default : value;

  if (prop.type === "boolean") {
    return (
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <Switch checked={!!current} onCheckedChange={(c) => onChange(c)} />
      </div>
    );
  }
  if (prop.type === "select") {
    return (
      <div className="flex flex-col gap-1">
        <Label className="text-xs">{label}</Label>
        <Select value={current ? String(current) : undefined} onValueChange={(v) => onChange(v)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {(prop.options ?? []).map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (prop.type === "richtext") {
    return (
      <div className="flex flex-col gap-1">
        <Label className="text-xs">{label}</Label>
        <Textarea
          className="min-h-[60px] text-xs"
          value={current === undefined || current === null ? "" : String(current)}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs">{label}</Label>
      <Input
        className="h-8 text-xs"
        type={prop.type === "number" ? "number" : "text"}
        value={current === undefined || current === null ? "" : String(current)}
        onChange={(e) =>
          onChange(
            prop.type === "number"
              ? e.target.value === ""
                ? undefined
                : Number(e.target.value)
              : e.target.value,
          )
        }
      />
    </div>
  );
};
