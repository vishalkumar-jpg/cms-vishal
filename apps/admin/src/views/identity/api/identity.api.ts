import { request } from "@/services/AxiosService";

/**
 * Identity center API (Phase 3). Header-scoped to the active site (X-Site-Id,
 * injected by AxiosService) — no siteId in the path.
 */

export interface VisitorRow {
  id: string;
  visitorId: string;
  identityId: string | null;
  email: string | null;
  companyName: string | null;
  score: number;
  sessions: number;
  pageviews: number;
  lastSource: string | null;
  lastSeen: string | null;
  identified: boolean;
}

export interface VisitorsQuery {
  sort?: "score" | "lastSeen" | "pageviews";
  identified?: boolean;
  limit?: number;
}

export const listVisitorsRequest = (q: VisitorsQuery = {}): Promise<VisitorRow[]> =>
  request<VisitorRow[]>({ url: "/identity/visitors", method: "GET", params: q });

export interface TimelineEvent {
  ts: string;
  type: string;
  path: string;
  source: string;
  device: string;
}

export interface Visitor360 {
  profile: {
    id: string;
    visitorId: string;
    firstSeen: string | null;
    lastSeen: string | null;
    sessions: number;
    pageviews: number;
    lastSource: string | null;
    lastDevice: string | null;
    topPaths: Array<{ path: string; views: number }>;
    identityId: string | null;
    score: number;
  };
  identity: { email: string; name: string | null } | null;
  company: { domain: string; name: string | null; industry: string | null; size: string | null } | null;
  timeline: TimelineEvent[];
}

export const getVisitorRequest = (id: string): Promise<Visitor360> =>
  request<Visitor360>({ url: `/identity/visitors/${id}`, method: "GET" });

export interface IdentityRow {
  id: string;
  primaryEmail: string;
  name: string | null;
  companyName: string | null;
  companyDomain: string | null;
  createdAt: string;
}

export const listIdentitiesRequest = (): Promise<IdentityRow[]> =>
  request<IdentityRow[]>({ url: "/identity/identities", method: "GET" });

export interface CompanyRow {
  id: string;
  domain: string;
  name: string | null;
  industry: string | null;
  size: string | null;
  people: number;
}

export const listCompaniesRequest = (): Promise<CompanyRow[]> =>
  request<CompanyRow[]>({ url: "/identity/companies", method: "GET" });

// --- Scoring rules ----------------------------------------------------------

export interface ScoringCondition {
  field: string;
  op: string;
  value?: string | number | boolean;
}

export interface ScoringRule {
  id: string;
  name: string;
  condition: ScoringCondition;
  points: number;
  active: string;
}

export interface ScoringRuleInput {
  name: string;
  condition: ScoringCondition;
  points: number;
  active?: boolean;
}

export const listScoringRulesRequest = (): Promise<ScoringRule[]> =>
  request<ScoringRule[]>({ url: "/identity/scoring-rules", method: "GET" });

export const createScoringRuleRequest = (data: ScoringRuleInput): Promise<ScoringRule> =>
  request<ScoringRule>({ url: "/identity/scoring-rules", method: "POST", data });

export const updateScoringRuleRequest = (id: string, data: ScoringRuleInput): Promise<ScoringRule> =>
  request<ScoringRule>({ url: `/identity/scoring-rules/${id}`, method: "PUT", data });

export const deleteScoringRuleRequest = (id: string): Promise<{ id: string }> =>
  request<{ id: string }>({ url: `/identity/scoring-rules/${id}`, method: "DELETE" });

export interface RuleField {
  name: string;
  label: string;
  type: string;
}

export const getRuleFieldsRequest = (): Promise<{ fields: RuleField[]; operators: string[] }> =>
  request<{ fields: RuleField[]; operators: string[] }>({
    url: "/identity/rule-fields",
    method: "GET",
  });

export const rebuildRequest = (): Promise<{ enqueued: boolean; jobId?: string }> =>
  request<{ enqueued: boolean; jobId?: string }>({ url: "/identity/rebuild", method: "POST" });
