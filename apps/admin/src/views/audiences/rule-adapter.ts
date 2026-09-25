import {
  newGroup,
  type RuleCondition,
  type RuleGroup as BuilderGroup,
  type RuleNode,
  type RuleOperator,
} from "@/components/rule-builder";

/**
 * Bridge between the reusable RuleBuilder's editor model (kind-tagged tree,
 * operators: equals/notEquals/contains/greaterThan/lessThan/notEmpty/empty) and
 * the Phase-3 audience/scoring API shape ({ logic, conditions:[{field,op,value}]}
 * with operators eq/neq/contains/gt/lt/gte/lte/isTrue/isFalse). The forms
 * adapter is NOT reused — it flattens to a single condition, but audiences need
 * the full boolean tree.
 */

export interface ApiCondition {
  field: string;
  op: string;
  value?: string | number | boolean;
}
export interface ApiRuleGroup {
  logic: "and" | "or";
  conditions: Array<ApiCondition | ApiRuleGroup>;
}

const OP_TO_API: Record<RuleOperator, string> = {
  equals: "eq",
  notEquals: "neq",
  contains: "contains",
  greaterThan: "gt",
  lessThan: "lt",
  notEmpty: "isTrue",
  empty: "isFalse",
};

const OP_FROM_API: Record<string, RuleOperator> = {
  eq: "equals",
  neq: "notEquals",
  contains: "contains",
  gt: "greaterThan",
  gte: "greaterThan",
  lt: "lessThan",
  lte: "lessThan",
  isTrue: "notEmpty",
  isFalse: "empty",
};

const isBuilderGroup = (n: RuleNode): n is BuilderGroup => n.kind === "group";

/** Editor tree → API shape (for persistence / preview). */
export function builderToApi(group: BuilderGroup): ApiRuleGroup {
  return {
    logic: group.logic,
    conditions: group.conditions.map((n) =>
      isBuilderGroup(n) ? builderToApi(n) : conditionToApi(n),
    ),
  };
}

function conditionToApi(c: RuleCondition): ApiCondition {
  const op = OP_TO_API[c.op] ?? "eq";
  // Numeric coercion for comparison operators keeps the value comparable.
  const numeric = ["gt", "lt", "gte", "lte"].includes(op) && c.value !== "" && !Number.isNaN(Number(c.value));
  const out: ApiCondition = { field: c.field, op };
  if (op !== "isTrue" && op !== "isFalse") {
    out.value = numeric ? Number(c.value) : c.value;
  }
  return out;
}

/** API shape → editor tree (for loading a saved audience into the builder). */
export function apiToBuilder(group: ApiRuleGroup | undefined | null): BuilderGroup {
  if (!group || !Array.isArray(group.conditions)) return newGroup("and");
  return {
    kind: "group",
    logic: group.logic === "or" ? "or" : "and",
    conditions: group.conditions.map((n) =>
      (n as ApiRuleGroup).logic
        ? apiToBuilder(n as ApiRuleGroup)
        : conditionFromApi(n as ApiCondition),
    ),
  };
}

function conditionFromApi(c: ApiCondition): RuleCondition {
  return {
    kind: "condition",
    field: c.field,
    op: OP_FROM_API[c.op] ?? "equals",
    value: c.value === undefined || c.value === null ? "" : String(c.value),
  };
}
