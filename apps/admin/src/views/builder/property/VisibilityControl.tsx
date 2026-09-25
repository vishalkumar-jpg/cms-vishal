import * as React from "react";
import { Eye } from "lucide-react";
import { Input, Label } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VisibleIf } from "@ob-cms/block-schema";
import { useAudiences } from "@/views/audiences/hooks/useAudiences";
import {
  useBindableFields,
  useNodeDynamic,
  useSetVisibleIf,
} from "./useNodeBinding";

/**
 * Node-level conditional visibility control (Content tab). Lets an author hide a
 * block on the published site unless a condition holds:
 *  - Always (default) — no condition.
 *  - Locale — only on a given locale's page (`eq`/`neq` a locale code).
 *  - Authenticated — only for signed-in visitors (visitor-auth seam).
 *  - Field — within a Repeater, compare an item field (`eq`/`neq`/truthy/falsy).
 *
 * Stored on the node's `visibleIf` (Craft `custom`, hoisted on save). The
 * renderer hides the node when the condition fails; the editor dims it + shows a
 * "hidden" badge so it stays editable.
 */
export const VisibilityControl: React.FC<{ nodeId: string }> = ({ nodeId }) => {
  const { visibleIf } = useNodeDynamic(nodeId);
  const setVisibleIf = useSetVisibleIf(nodeId);
  const fields = useBindableFields(nodeId);
  const { data: audiences = [] } = useAudiences();

  const type = visibleIf?.type ?? "always";
  const op = visibleIf?.op ?? "eq";

  const patch = (next: Partial<VisibleIf>): void => {
    const base: VisibleIf = visibleIf ?? { type: "always" };
    setVisibleIf({ ...base, ...next } as VisibleIf);
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-2">
      <div className="flex items-center gap-1.5">
        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
        <Label className="text-xs font-medium">Visibility</Label>
      </div>

      <Select
        value={type}
        onValueChange={(v) =>
          v === "always"
            ? setVisibleIf(undefined)
            : patch({ type: v as VisibleIf["type"] })
        }
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="always">Always visible</SelectItem>
          <SelectItem value="locale">Only on locale…</SelectItem>
          <SelectItem value="authenticated">Only signed-in visitors</SelectItem>
          <SelectItem value="field">When item field…</SelectItem>
          <SelectItem value="audience">🎯 For audience…</SelectItem>
        </SelectContent>
      </Select>

      {type === "audience" ? (
        <div className="flex flex-col gap-1.5">
          <Select
            value={visibleIf?.audienceOp ?? "in"}
            onValueChange={(v) => patch({ audienceOp: v as VisibleIf["audienceOp"] })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="in">Visitor is in</SelectItem>
              <SelectItem value="not-in">Visitor is NOT in</SelectItem>
            </SelectContent>
          </Select>
          {audiences.length > 0 ? (
            <Select
              value={visibleIf?.audienceId}
              onValueChange={(v) => patch({ audienceId: v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Pick an audience…" />
              </SelectTrigger>
              <SelectContent>
                {audiences.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              No audiences yet — create one under Insights → Audiences.
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            Shown on the published site based on the visitor's audience membership. The editor
            always shows it so you can keep authoring.
          </p>
        </div>
      ) : null}

      {type === "locale" ? (
        <div className="flex items-center gap-1.5">
          <Select value={op} onValueChange={(v) => patch({ op: v as VisibleIf["op"] })}>
            <SelectTrigger className="h-8 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="eq">is</SelectItem>
              <SelectItem value="neq">is not</SelectItem>
            </SelectContent>
          </Select>
          <Input
            className="h-8 text-xs"
            placeholder="es"
            value={visibleIf?.value ?? ""}
            onChange={(e) => patch({ value: e.target.value })}
          />
        </div>
      ) : null}

      {type === "field" ? (
        <div className="flex flex-col gap-1.5">
          {fields.length > 0 ? (
            <Select value={visibleIf?.field} onValueChange={(v) => patch({ field: v })}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Pick a field…" />
              </SelectTrigger>
              <SelectContent>
                {fields.map((f) => (
                  <SelectItem key={f.key} value={f.key}>
                    {f.label || f.key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Bindable fields appear in the Collection Detail Builder or inside a Repeater.
            </p>
          )}
          <div className="flex items-center gap-1.5">
            <Select value={op} onValueChange={(v) => patch({ op: v as VisibleIf["op"] })}>
              <SelectTrigger className="h-8 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="truthy">is set</SelectItem>
                <SelectItem value="falsy">is empty</SelectItem>
                <SelectItem value="eq">equals</SelectItem>
                <SelectItem value="neq">not equals</SelectItem>
              </SelectContent>
            </Select>
            {op === "eq" || op === "neq" ? (
              <Input
                className="h-8 text-xs"
                placeholder="value"
                value={visibleIf?.value ?? ""}
                onChange={(e) => patch({ value: e.target.value })}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {type === "authenticated" ? (
        <p className="text-[11px] text-muted-foreground">
          Shown only to signed-in visitors. Visitor sessions are a documented seam — until
          plumbed, this stays visible on the published site.
        </p>
      ) : null}
    </div>
  );
};
