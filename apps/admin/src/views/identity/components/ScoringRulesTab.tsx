import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { toast } from "@/components/ui/toaster";
import { useConfirm } from "@/components/ui/confirm-provider";
import { DELETE_CONFIRM_LABEL } from "@/components/ui/confirm-labels";
import { useRuleFields, useScoringRuleMutations, useScoringRules } from "../hooks/useIdentity";
import type { ScoringRule, ScoringRuleInput } from "../api/identity.api";

const OP_LABELS: Record<string, string> = {
  eq: "equals",
  neq: "does not equal",
  gte: "at least (≥)",
  lte: "at most (≤)",
  gt: "greater than",
  lt: "less than",
  contains: "contains",
  isTrue: "is true",
  isFalse: "is false",
};

const emptyDraft: ScoringRuleInput = {
  name: "",
  condition: { field: "pageviews", op: "gte", value: 5 },
  points: 10,
  active: true,
};

/** The lead-scoring rule editor: define a condition worth N points. */
export function ScoringRulesTab() {
  const { data: rules, isLoading } = useScoringRules();
  const { data: meta } = useRuleFields();
  const { create, update, remove } = useScoringRuleMutations();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ScoringRule | null>(null);
  const [draft, setDraft] = useState<ScoringRuleInput>(emptyDraft);

  const fields = meta?.fields ?? [];
  const operators = meta?.operators ?? Object.keys(OP_LABELS);

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setOpen(true);
  };
  const openEdit = (r: ScoringRule) => {
    setEditing(r);
    setDraft({
      name: r.name,
      condition: r.condition,
      points: r.points,
      active: r.active === "true",
    });
    setOpen(true);
  };

  const doDelete = (rule: ScoringRule): void => {
    void (async () => {
      const ok = await confirm({
        title: `Delete "${rule.name}"?`,
        description: "This scoring rule will stop contributing to lead scores immediately.",
        confirmLabel: DELETE_CONFIRM_LABEL,
        destructive: true,
      });
      if (!ok) return;
      remove.mutate(rule.id, {
        onSuccess: () => toast.success("Scoring rule deleted"),
        onError: () => toast.error("Could not delete scoring rule"),
      });
    })();
  };

  const save = () => {
    if (!draft.name.trim()) return;
    if (editing) update.mutate({ id: editing.id, data: draft }, { onSuccess: () => setOpen(false) });
    else create.mutate(draft, { onSuccess: () => setOpen(false) });
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Each matching active rule adds its points to a visitor’s lead score.
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New rule
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Rule</th>
              <th className="px-3 py-2 font-medium">Condition</th>
              <th className="px-3 py-2 text-right font-medium">Points</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (rules ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  No scoring rules yet.
                </td>
              </tr>
            )}
            {(rules ?? []).map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-medium text-foreground">{r.name}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  <code className="text-xs">
                    {r.condition.field} {OP_LABELS[r.condition.op] ?? r.condition.op}{" "}
                    {r.condition.value !== undefined ? String(r.condition.value) : ""}
                  </code>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">+{r.points}</td>
                <td className="px-3 py-2">
                  <Badge variant={r.active === "true" ? "success" : "muted"}>
                    {r.active === "true" ? "active" : "off"}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => doDelete(r)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit scoring rule" : "New scoring rule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rule-name">Name</Label>
              <Input
                id="rule-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Engaged visitor"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Field</Label>
                <Select
                  value={draft.condition.field}
                  onValueChange={(v) =>
                    setDraft({ ...draft, condition: { ...draft.condition, field: v } })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((f) => (
                      <SelectItem key={f.name} value={f.name}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Operator</Label>
                <Select
                  value={draft.condition.op}
                  onValueChange={(v) =>
                    setDraft({ ...draft, condition: { ...draft.condition, op: v } })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map((op) => (
                      <SelectItem key={op} value={op}>
                        {OP_LABELS[op] ?? op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Value</Label>
                <Input
                  value={draft.condition.value === undefined ? "" : String(draft.condition.value)}
                  disabled={draft.condition.op === "isTrue" || draft.condition.op === "isFalse"}
                  onChange={(e) =>
                    setDraft({ ...draft, condition: { ...draft.condition, value: e.target.value } })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="rule-points">Points</Label>
                <Input
                  id="rule-points"
                  type="number"
                  value={draft.points}
                  onChange={(e) => setDraft({ ...draft, points: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Active</Label>
                <Select
                  value={draft.active ? "true" : "false"}
                  onValueChange={(v) => setDraft({ ...draft, active: v === "true" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={create.isPending || update.isPending}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
