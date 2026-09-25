/**
 * Shared rule-builder data model (backlog #33). A reusable visual editor for
 * field / operator / value conditions with AND/OR grouping. Kept dependency-free
 * and decoupled from any one consumer (forms today; audiences / redirects next).
 *
 * IMPORTANT — server compatibility: the OB-CMS forms server evaluates a SINGLE
 * `{ field, op, value }` rule per field (`apps/api .../conditional-logic.ts#isFieldVisible`,
 * ops: equals | notEquals | contains | notEmpty | empty, unknown ops fall back to
 * equals). The richer group model below is the EDITOR's own shape; the forms
 * adapter (`forms-adapter.ts`) flattens it to / from that single-condition shape
 * so we never change the API contract.
 */

/**
 * Operators the builder can author. The first five are exactly what the forms
 * server understands; `greaterThan` / `lessThan` are offered for numeric/date
 * fields and for future consumers (server-side support is the consumer's job).
 */
export const RULE_OPERATORS = [
  "equals",
  "notEquals",
  "contains",
  "notEmpty",
  "empty",
  "greaterThan",
  "lessThan",
] as const;

export type RuleOperator = (typeof RULE_OPERATORS)[number];

/** Operators that take no value input (the value box is hidden for these). */
export const VALUELESS_OPERATORS: ReadonlySet<RuleOperator> = new Set([
  "notEmpty",
  "empty",
]);

/** Human labels for the operator dropdown. */
export const OPERATOR_LABELS: Record<RuleOperator, string> = {
  equals: "equals",
  notEquals: "does not equal",
  contains: "contains",
  notEmpty: "is not empty",
  empty: "is empty",
  greaterThan: "greater than",
  lessThan: "less than",
};

/**
 * A selectable field offered in the "field" dropdown. `type` is optional; when
 * present it drives operator filtering (see `operatorsForType`).
 */
export interface RuleField {
  /** Machine name written into the emitted condition's `field`. */
  name: string;
  /** Display label for the dropdown (falls back to `name`). */
  label?: string;
  /** Field type hint, used to filter the operator list. */
  type?: string;
}

/** A single field/operator/value condition (leaf of the rule tree). */
export interface RuleCondition {
  kind: "condition";
  field: string;
  op: RuleOperator;
  value: string;
}

/** An AND/OR group of conditions and/or nested groups. */
export interface RuleGroup {
  kind: "group";
  logic: "and" | "or";
  conditions: Array<RuleCondition | RuleGroup>;
}

export type RuleNode = RuleCondition | RuleGroup;

/** Field types for which numeric/date comparison operators make sense. */
const COMPARABLE_TYPES: ReadonlySet<string> = new Set(["number", "date"]);

/** Text-like types where `greaterThan` / `lessThan` are not meaningful. */
const NO_COMPARE_TYPES: ReadonlySet<string> = new Set([
  "checkbox",
  "consent",
  "select",
  "multiselect",
  "radio",
]);

/**
 * Operators valid for a given field type. With no type info, all operators are
 * offered. Numeric/date fields get the comparison ops; obviously-non-comparable
 * types drop them.
 */
export function operatorsForType(type?: string): RuleOperator[] {
  const all = [...RULE_OPERATORS];
  if (!type) return all;
  if (COMPARABLE_TYPES.has(type)) return all;
  if (NO_COMPARE_TYPES.has(type)) {
    return all.filter((op) => op !== "greaterThan" && op !== "lessThan");
  }
  // Plain text-ish fields: comparisons are rarely useful but harmless to drop.
  return all.filter((op) => op !== "greaterThan" && op !== "lessThan");
}

export const newCondition = (firstFieldName = ""): RuleCondition => ({
  kind: "condition",
  field: firstFieldName,
  op: "equals",
  value: "",
});

export const newGroup = (logic: "and" | "or" = "and"): RuleGroup => ({
  kind: "group",
  logic,
  conditions: [],
});
