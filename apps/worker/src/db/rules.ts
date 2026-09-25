/**
 * Worker-local mirror of apps/api/src/modules/identity/rules.ts (the rule
 * evaluation + business-domain logic). Kept a standalone copy so the Bun worker
 * doesn't import NestJS code. Keep in sync with the API's rules.ts.
 */

export interface ProfileView {
  pageviews: number;
  sessions: number;
  score: number;
  source: string | null;
  device: string | null;
  isIdentified: boolean;
  hasCompany: boolean;
  paths: string[];
  email: string | null;
  companyDomain: string | null;
}

export interface Condition {
  field: string;
  op: string;
  value?: string | number | boolean;
}

export interface RuleGroup {
  logic: "and" | "or";
  conditions: Array<Condition | RuleGroup>;
}

const isGroup = (n: Condition | RuleGroup): n is RuleGroup =>
  (n as RuleGroup).logic !== undefined && Array.isArray((n as RuleGroup).conditions);

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : NaN;
};

const toBool = (v: unknown): boolean => v === true || v === "true" || v === 1 || v === "1";

export function evalCondition(c: Condition, p: ProfileView): boolean {
  const op = c.op;
  if (c.field === "visitedPath") {
    const needle = String(c.value ?? "").toLowerCase();
    if (!needle) return false;
    if (op === "eq") return p.paths.includes(needle);
    return p.paths.some((path) => path.includes(needle));
  }

  const actual = (p as unknown as Record<string, unknown>)[c.field];

  switch (op) {
    case "isTrue":
      return actual === true;
    case "isFalse":
      return actual === false || actual === null || actual === undefined;
    case "eq":
      if (typeof actual === "boolean") return actual === toBool(c.value);
      return String(actual ?? "").toLowerCase() === String(c.value ?? "").toLowerCase();
    case "neq":
      return String(actual ?? "").toLowerCase() !== String(c.value ?? "").toLowerCase();
    case "contains":
      return String(actual ?? "").toLowerCase().includes(String(c.value ?? "").toLowerCase());
    case "gte":
      return num(actual) >= num(c.value);
    case "lte":
      return num(actual) <= num(c.value);
    case "gt":
      return num(actual) > num(c.value);
    case "lt":
      return num(actual) < num(c.value);
    default:
      return false;
  }
}

export function evalGroup(g: RuleGroup, p: ProfileView): boolean {
  const nodes = g?.conditions ?? [];
  if (nodes.length === 0) return true;
  const results = nodes.map((n) => (isGroup(n) ? evalGroup(n, p) : evalCondition(n, p)));
  return g.logic === "or" ? results.some(Boolean) : results.every(Boolean);
}
