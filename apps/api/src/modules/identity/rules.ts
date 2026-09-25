/**
 * Shared rule evaluation for Phase-3 lead scoring + audience segmentation.
 *
 * A "profile view" is the flattened field set evaluated against — derived from a
 * `visitor_profiles` row joined to its identity/company. Both scoring rules
 * (single condition) and audience definitions (an AND/OR group of conditions)
 * evaluate over the SAME field set + operators, so this is the single source of
 * truth (the admin field pickers mirror it).
 */

/** The flattened, evaluable view of a visitor profile (+ identity/company). */
export interface ProfileView {
  pageviews: number;
  sessions: number;
  score: number;
  source: string | null;
  device: string | null;
  isIdentified: boolean;
  hasCompany: boolean;
  /** Lowercased set of paths the visitor viewed (from topPaths). */
  paths: string[];
  email: string | null;
  companyDomain: string | null;
}

/** Fields exposed to the rule builders (name → the ProfileView-derived value type). */
export const RULE_FIELDS = [
  { name: "pageviews", label: "Pageviews", type: "number" },
  { name: "sessions", label: "Sessions", type: "number" },
  { name: "score", label: "Lead score", type: "number" },
  { name: "source", label: "Last source", type: "string" },
  { name: "device", label: "Last device", type: "string" },
  { name: "isIdentified", label: "Is identified", type: "boolean" },
  { name: "hasCompany", label: "Has company", type: "boolean" },
  { name: "visitedPath", label: "Visited path", type: "string" },
  { name: "email", label: "Email", type: "string" },
  { name: "companyDomain", label: "Company domain", type: "string" },
] as const;

export const RULE_OPERATORS = [
  "eq",
  "neq",
  "gte",
  "lte",
  "gt",
  "lt",
  "contains",
  "isTrue",
  "isFalse",
] as const;
export type RuleOperator = (typeof RULE_OPERATORS)[number];

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

/** Coerce a rule value + a profile value to comparable numbers where sensible. */
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : NaN;
};

/** Evaluate a single condition against a profile view. */
export function evalCondition(c: Condition, p: ProfileView): boolean {
  const op = c.op;
  // `visitedPath` is a special multi-value field: does any viewed path match?
  if (c.field === "visitedPath") {
    const needle = String(c.value ?? "").toLowerCase();
    if (!needle) return false;
    if (op === "eq") return p.paths.includes(needle);
    return p.paths.some((path) => path.includes(needle)); // contains (default)
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

const toBool = (v: unknown): boolean => v === true || v === "true" || v === 1 || v === "1";

/** Evaluate an AND/OR condition group against a profile view. */
export function evalGroup(g: RuleGroup, p: ProfileView): boolean {
  const nodes = g.conditions ?? [];
  if (nodes.length === 0) return true; // an empty group matches everyone
  const results = nodes.map((n) => (isGroup(n) ? evalGroup(n, p) : evalCondition(n, p)));
  return g.logic === "or" ? results.some(Boolean) : results.every(Boolean);
}

/** Free email providers — an email on these domains does NOT create a company. */
export const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "ymail.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "mail.com",
  "zoho.com",
  "yandex.com",
]);

/** Extract a lowercased domain from an email, or null if malformed. */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain && domain.includes(".") ? domain : null;
}

/** A business domain (not a free provider) qualifies for company identification. */
export function isBusinessDomain(domain: string | null): boolean {
  return !!domain && !FREE_EMAIL_DOMAINS.has(domain);
}
