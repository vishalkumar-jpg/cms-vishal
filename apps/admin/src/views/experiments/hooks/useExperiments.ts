import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ADMIN_QUERY_KEYS } from "@/services/queryKeys";
import { useSiteStore } from "@/store/siteStore";
import { toast } from "@/components/ui";
import {
  createExperimentRequest,
  deleteExperimentRequest,
  experimentResultsRequest,
  listExperimentsRequest,
  setExperimentStatusRequest,
  updateExperimentRequest,
  type Experiment,
  type ExperimentInput,
  type ExperimentResults,
  type ExperimentStatus,
} from "../api/experiments.api";

export const useExperiments = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<Experiment[]>({
    queryKey: [ADMIN_QUERY_KEYS.EXPERIMENTS, siteId],
    queryFn: () => listExperimentsRequest(),
    enabled: !!siteId,
  });
};

export const useExperimentResults = (id: string | null) => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return useQuery<ExperimentResults>({
    queryKey: [ADMIN_QUERY_KEYS.EXPERIMENT_RESULTS, siteId, id],
    queryFn: () => experimentResultsRequest(id as string),
    enabled: !!siteId && !!id,
    refetchInterval: 15000,
  });
};

export const useExperimentMutations = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: [ADMIN_QUERY_KEYS.EXPERIMENTS, siteId] });

  const create = useMutation({
    mutationFn: (data: ExperimentInput) => createExperimentRequest(data),
    onSuccess: () => {
      invalidate();
      toast.success("Experiment created");
    },
    onError: () => toast.error("Could not create experiment"),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ExperimentInput }) =>
      updateExperimentRequest(id, data),
    onSuccess: () => {
      invalidate();
      toast.success("Experiment updated");
    },
    onError: () => toast.error("Could not update experiment"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteExperimentRequest(id),
    onSuccess: () => {
      invalidate();
      toast.success("Experiment deleted");
    },
    onError: () => toast.error("Could not delete experiment"),
  });

  const setStatus = useMutation({
    mutationFn: ({
      id,
      status,
      winnerVariantId,
    }: {
      id: string;
      status: ExperimentStatus;
      winnerVariantId?: string;
    }) => setExperimentStatusRequest(id, status, winnerVariantId),
    onSuccess: () => {
      invalidate();
      toast.success("Experiment updated");
    },
    onError: () => toast.error("Could not update experiment"),
  });

  return { create, update, remove, setStatus };
};
