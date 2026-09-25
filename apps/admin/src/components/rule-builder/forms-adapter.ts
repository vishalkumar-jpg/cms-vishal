/**
 * Forms ↔ RuleBuilder adapter (backlog #33).
 *
 * The OB-CMS forms server evaluates a SINGLE condition per field —
 * `conditional?: { field?, op?, value? }` with ops
 * `equals | notEquals | contains | notEmpty | empty` (unknown ops fall back to
 * `equals`; see apps/api `conditional-logic.ts#isFieldVisible`). We CANNOT change
 * the server, so the forms wiring stays on that exact single-condition shape.
 *
 * These helpers bridge that shape and the richer {@link RuleGroup} the visual
 * builder edits:
 *  - `conditionalToGroup` lifts a stored `{field, op, value}` into a one-condition
 *    AND group for editing.
 *  - `groupToConditional` flattens the edited group back to the single condition
 *    the server understands — it takes the FIRST authored leaf condition (the
 *    forms UI only ever shows one), so any extra rows/groups are ignored on save.
 *    This keeps round-tripping lossless for the supported single-rule case and
 *    forward-compatible if the server later learns groups.
 *
 * Only operators the server supports are emitted; `greaterThan`/`lessThan` are
 * filtered to `equals` to avoid writing an op the server would treat as `equals`
 * unexpectedly.
 */
import {
  type RuleCondition,
  type RuleGroup,
  type RuleOperator,
  newCondition,
  newGroup,
} from "./types";

/** The op set the forms server actually evaluates. */
const SERVER_OPS = ["equals", "notEquals", "contains", "notEmpty", "empty"] as const;
type ServerOp = (typeof SERVER_OPS)[number];

/**
 * Mirror of the forms `ConditionalRule` shape (kept local to avoid a forms
 * import). `op` is narrowed to the server-supported union so the emitted object
 * is assignable to the forms `ConditionalRule` type without a cast.
 */
export interface FormsConditional {
  field?: string;
  op?: ServerOp;
  value?: string;
}

function toServerOp(op: RuleOperator): ServerOp {
  return (SERVER_OPS as readonly string[]).includes(op) ? (op as ServerOp) : "equals";
}

/** Lift a stored forms `conditional` into a single-condition AND group for editing. */
export function conditionalToGroup(rule: FormsConditional | undefined): RuleGroup {
  const group = newGroup("and");
  // Only seed a condition when a field was actually chosen — an empty rule means
  // "always show" and should render as an empty builder.
  if (rule?.field) {
    const cond = newCondition(rule.field);
    cond.op = (rule.op as RuleOperator) ?? "equals";
    cond.value = rule.value ?? "";
    group.conditions = [cond];
  }
  return group;
}

/** Find the first leaf condition (depth-first) anywhere in the group. */
function firstCondition(group: RuleGroup): RuleCondition | undefined {
  for (const child of group.conditions) {
    if (child.kind === "condition") return child;
    const nested = firstCondition(child);
    if (nested) return nested;
  }
  return undefined;
}

/**
 * Flatten the edited group to the single `conditional` the forms server stores.
 * Returns `undefined` when no usable condition was authored (→ "always show").
 */
export function groupToConditional(group: RuleGroup): FormsConditional | undefined {
  const cond = firstCondition(group);
  if (!cond || !cond.field) return undefined;
  const op = toServerOp(cond.op);
  const out: FormsConditional = { field: cond.field, op };
  // Value-bearing ops keep the value; empty/notEmpty drop it.
  if (op !== "empty" && op !== "notEmpty") out.value = cond.value ?? "";
  return out;
}
