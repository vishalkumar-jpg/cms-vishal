import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import { toast } from "@/components/ui";
import {
  createScoringRuleRequest,
  deleteScoringRuleRequest,
  getRuleFieldsRequest,
  getVisitorRequest,
  listCompaniesRequest,
  listIdentitiesRequest,
  listScoringRulesRequest,
  listVisitorsRequest,
  rebuildRequest,
  updateScoringRuleRequest,
  type CompanyRow,
  type IdentityRow,
  type RuleField,
  type ScoringRule,
  type ScoringRuleInput,
  type Visitor360,
  type VisitorRow,
  type VisitorsQuery,
} from "../api/identity.api";

export const useVisitors = (q: VisitorsQuery) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<VisitorRow[]>({
    queryKey: [ADMIN_QUERY_KEYS.IDENTITY_VISITORS, siteId, q.sort, q.identified, q.limit],
    queryFn: () => listVisitorsRequest(q),
    enabled: !!siteId,
  });
};

export const useVisitor = (id: string | null) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<Visitor360>({
    queryKey: [ADMIN_QUERY_KEYS.IDENTITY_VISITOR, siteId, id],
    queryFn: () => getVisitorRequest(id as string),
    enabled: !!siteId && !!id,
  });
};

export const useIdentities = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<IdentityRow[]>({
    queryKey: [ADMIN_QUERY_KEYS.IDENTITY_IDENTITIES, siteId],
    queryFn: () => listIdentitiesRequest(),
    enabled: !!siteId,
  });
};

export const useCompanies = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<CompanyRow[]>({
    queryKey: [ADMIN_QUERY_KEYS.IDENTITY_COMPANIES, siteId],
    queryFn: () => listCompaniesRequest(),
    enabled: !!siteId,
  });
};

export const useScoringRules = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<ScoringRule[]>({
    queryKey: [ADMIN_QUERY_KEYS.IDENTITY_SCORING_RULES, siteId],
    queryFn: () => listScoringRulesRequest(),
    enabled: !!siteId,
  });
};

export const useRuleFields = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<{ fields: RuleField[]; operators: string[] }>({
    queryKey: [ADMIN_QUERY_KEYS.IDENTITY_RULE_FIELDS, siteId],
    queryFn: () => getRuleFieldsRequest(),
    enabled: !!siteId,
  });
};

export const useScoringRuleMutations = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.IDENTITY_SCORING_RULES, siteId] });

  const create = useMutation({
    mutationFn: (data: ScoringRuleInput) => createScoringRuleRequest(data),
    onSuccess: () => {
      invalidate();
      toast.success("Scoring rule created");
    },
    onError: () => toast.error("Could not create rule"),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ScoringRuleInput }) =>
      updateScoringRuleRequest(id, data),
    onSuccess: () => {
      invalidate();
      toast.success("Scoring rule updated");
    },
    onError: () => toast.error("Could not update rule"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteScoringRuleRequest(id),
    onSuccess: () => {
      invalidate();
      toast.success("Scoring rule deleted");
    },
    onError: () => toast.error("Could not delete rule"),
  });

  return { create, update, remove };
};

export const useRebuild = () => {
  const qc = useQueryClient();
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useMutation({
    mutationFn: () => rebuildRequest(),
    onSuccess: () => {
      toast.success("Rebuild queued — profiles + scores refresh shortly");
      qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.IDENTITY_VISITORS, siteId] });
    },
    onError: () => toast.error("Could not queue rebuild"),
  });
};
