import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import { toast } from "@/components/ui";
import {
  createWorkflowRequest,
  deleteWorkflowRequest,
  listWorkflowRunsRequest,
  listWorkflowsRequest,
  setWorkflowStatusRequest,
  updateWorkflowRequest,
  type Workflow,
  type WorkflowInput,
  type WorkflowRun,
} from "../api/workflows.api";

export const useWorkflows = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<Workflow[]>({
    queryKey: [ADMIN_QUERY_KEYS.WORKFLOWS, siteId],
    queryFn: () => listWorkflowsRequest(),
    enabled: !!siteId,
  });
};

export const useWorkflowRuns = (id: string | null) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<WorkflowRun[]>({
    queryKey: [ADMIN_QUERY_KEYS.WORKFLOW_RUNS, siteId, id],
    queryFn: () => listWorkflowRunsRequest(id as string),
    enabled: !!siteId && !!id,
    refetchInterval: 4000,
  });
};

export const useWorkflowMutations = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.WORKFLOWS, siteId] });

  const create = useMutation({
    mutationFn: (data: WorkflowInput) => createWorkflowRequest(data),
    onSuccess: () => {
      invalidate();
      toast.success("Workflow created");
    },
    onError: () => toast.error("Could not create workflow"),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: WorkflowInput }) => updateWorkflowRequest(id, data),
    onSuccess: () => {
      invalidate();
      toast.success("Workflow updated");
    },
    onError: () => toast.error("Could not update workflow"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteWorkflowRequest(id),
    onSuccess: () => {
      invalidate();
      toast.success("Workflow deleted");
    },
    onError: () => toast.error("Could not delete workflow"),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "paused" }) =>
      setWorkflowStatusRequest(id, status),
    onSuccess: (_data, vars) => {
      invalidate();
      toast.success(vars.status === "active" ? "Workflow activated" : "Workflow paused");
    },
    onError: () => toast.error("Could not change status"),
  });

  return { create, update, remove, setStatus };
};
