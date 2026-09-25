/**
 * RuleBuilder — a reusable, dependency-light visual condition editor (backlog #33).
 *
 * Edits a {@link RuleGroup} `{ logic: "and"|"or", conditions: (RuleCondition | RuleGroup)[] }`
 * with at least one level of AND/OR grouping (nested groups are supported by the
 * data model and rendered recursively). Controlled component: pass `value` +
 * `onChange`. Reuses the admin `@/components/ui` primitives only — no new deps.
 *
 * The forms wiring flattens this group to the server's single `{field, op, value}`
 * shape via `forms-adapter.ts`; the component itself is consumer-agnostic.
 */
import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/cn";
import {
  type RuleField,
  type RuleGroup,
  type RuleNode,
  type RuleOperator,
  OPERATOR_LABELS,
  VALUELESS_OPERATORS,
  newCondition,
  newGroup,
  operatorsForType,
} from "./types";

export interface RuleBuilderProps {
  /** Fields offered in each condition's "field" dropdown. */
  fields: RuleField[];
  /** Controlled value: the root group. */
  value: RuleGroup;
  onChange: (next: RuleGroup) => void;
  /** Max nesting depth for groups (default 2: root + one nested level). */
  maxDepth?: number;
  className?: string;
}

const NONE = "__none__";

/** Immutably replace the child at `index` within a group's conditions. */
function replaceChild(group: RuleGroup, index: number, child: RuleNode): RuleGroup {
  return {
    ...group,
    conditions: group.conditions.map((c, i) => (i === index ? child : c)),
  };
}

function removeChild(group: RuleGroup, index: number): RuleGroup {
  return { ...group, conditions: group.conditions.filter((_, i) => i !== index) };
}

const LogicToggle: React.FC<{
  logic: "and" | "or";
  onChange: (logic: "and" | "or") => void;
}> = ({ logic, onChange }) => (
  <div className="inline-flex overflow-hidden rounded-md border border-border text-xs">
    {(["and", "or"] as const).map((opt) => (
      <button
        key={opt}
        type="button"
        onClick={() => onChange(opt)}
        className={cn(
          "px-2.5 py-1 font-medium uppercase tracking-wide transition-colors",
          logic === opt
            ? "bg-primary text-primary-foreground"
            : "bg-background text-muted-foreground hover:bg-muted",
        )}
      >
        {opt}
      </button>
    ))}
  </div>
);

const ConditionRow: React.FC<{
  fields: RuleField[];
  condition: Extract<RuleNode, { kind: "condition" }>;
  onChange: (next: Extract<RuleNode, { kind: "condition" }>) => void;
  onRemove: () => void;
}> = ({ fields, condition, onChange, onRemove }) => {
  const fieldDef = fields.find((f) => f.name === condition.field);
  const ops = operatorsForType(fieldDef?.type);
  const showValue = !VALUELESS_OPERATORS.has(condition.op);

  return (
    <div className="flex items-start gap-2">
      <div className="grid flex-1 grid-cols-3 gap-2">
        <Select
          value={condition.field || NONE}
          onValueChange={(v) => onChange({ ...condition, field: v === NONE ? "" : v })}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Field" />
          </SelectTrigger>
          <SelectContent>
            {fields.length === 0 && (
              <SelectItem value={NONE} disabled>
                No fields
              </SelectItem>
            )}
            {fields.map((f) => (
              <SelectItem key={f.name} value={f.name}>
                {f.label ?? f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={condition.op}
          onValueChange={(v) => onChange({ ...condition, op: v as RuleOperator })}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ops.map((op) => (
              <SelectItem key={op} value={op}>
                {OPERATOR_LABELS[op]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {showValue ? (
          <Input
            value={condition.value}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
            placeholder="value"
            className="h-8"
          />
        ) : (
          <div className="flex h-8 items-center text-xs text-muted-foreground">—</div>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-destructive"
        onClick={onRemove}
        aria-label="Remove condition"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

const GroupEditor: React.FC<{
  fields: RuleField[];
  group: RuleGroup;
  onChange: (next: RuleGroup) => void;
  onRemove?: () => void;
  depth: number;
  maxDepth: number;
}> = ({ fields, group, onChange, onRemove, depth, maxDepth }) => {
  const firstFieldName = fields[0]?.name ?? "";
  const canNest = depth < maxDepth;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-md border border-border p-2.5",
        depth > 0 && "bg-muted/30",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Match</span>
          <LogicToggle
            logic={group.logic}
            onChange={(logic) => onChange({ ...group, logic })}
          />
          <span className="text-xs text-muted-foreground">of the following</span>
        </div>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={onRemove}
            aria-label="Remove group"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {group.conditions.length === 0 && (
        <p className="px-1 text-xs text-muted-foreground">No conditions yet.</p>
      )}

      <div className="flex flex-col gap-2">
        {group.conditions.map((child, i) =>
          child.kind === "condition" ? (
            <ConditionRow
              key={i}
              fields={fields}
              condition={child}
              onChange={(next) => onChange(replaceChild(group, i, next))}
              onRemove={() => onChange(removeChild(group, i))}
            />
          ) : (
            <GroupEditor
              key={i}
              fields={fields}
              group={child}
              onChange={(next) => onChange(replaceChild(group, i, next))}
              onRemove={() => onChange(removeChild(group, i))}
              depth={depth + 1}
              maxDepth={maxDepth}
            />
          ),
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7"
          onClick={() =>
            onChange({
              ...group,
              conditions: [...group.conditions, newCondition(firstFieldName)],
            })
          }
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add condition
        </Button>
        {canNest && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7"
            onClick={() =>
              onChange({
                ...group,
                conditions: [...group.conditions, newGroup(group.logic === "and" ? "or" : "and")],
              })
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add group
          </Button>
        )}
      </div>
    </div>
  );
};

export const RuleBuilder: React.FC<RuleBuilderProps> = ({
  fields,
  value,
  onChange,
  maxDepth = 2,
  className,
}) => {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label className="sr-only">Rule builder</Label>
      <GroupEditor
        fields={fields}
        group={value}
        onChange={onChange}
        depth={0}
        maxDepth={maxDepth}
      />
    </div>
  );
};

RuleBuilder.displayName = "RuleBuilder";
