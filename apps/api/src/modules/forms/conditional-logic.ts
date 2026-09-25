/**
 * Conditional-logic evaluation (FORMS-ADVANCED §conditional). A field may carry
 * a `conditional` rule `{ field, op, value }`; the field is shown only when the
 * rule passes against the current submission data. The public renderer evaluates
 * the SAME rules client-side to show/hide inputs, and the server re-evaluates
 * them on submit so a hidden-by-logic field can't be injected via a crafted POST.
 *
 * Kept as a tiny dependency-free helper (no packages/blocks edits) so both the
 * API and any front-end form runtime can import the identical shape + operators.
 */
export type ConditionalOp = "equals" | "notEquals" | "contains" | "notEmpty" | "empty";

export interface ConditionalRule {
  field?: string;
  op?: ConditionalOp | string;
  value?: unknown;
}

/** True when a field with this rule should be VISIBLE given current data. */
export function isFieldVisible(
  rule: ConditionalRule | undefined,
  data: Record<string, unknown>,
): boolean {
  if (!rule || !rule.field) return true; // no rule → always visible
  const actual = data[rule.field];
  switch (rule.op) {
    case "notEmpty":
      return !isEmpty(actual);
    case "empty":
      return isEmpty(actual);
    case "notEquals":
      return !valueEquals(actual, rule.value);
    case "contains":
      return valueContains(actual, rule.value);
    case "equals":
    default:
      return valueEquals(actual, rule.value);
  }
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  return String(v).trim().length === 0;
}

function valueEquals(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(actual)) return actual.map(String).includes(String(expected));
  if (typeof actual === "boolean") return actual === (expected === true || expected === "true");
  return String(actual ?? "") === String(expected ?? "");
}

function valueContains(actual: unknown, expected: unknown): boolean {
  const needle = String(expected ?? "").toLowerCase();
  if (Array.isArray(actual)) return actual.map((v) => String(v).toLowerCase()).includes(needle);
  return String(actual ?? "").toLowerCase().includes(needle);
}
