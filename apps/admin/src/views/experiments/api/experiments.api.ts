import { request } from "@/services/AxiosService";

/** Experiments API (Phase 4). Header-scoped to the active site (X-Site-Id). */

export type ExperimentStatus = "draft" | "running" | "paused" | "done";
export type GoalType = "pageview" | "click" | "form_submit";

export interface ExperimentVariant {
  id: string;
  experimentId: string;
  key: string;
  name: string;
  weight: number;
  isControl: boolean;
}

export interface Experiment {
  id: string;
  name: string;
  description: string | null;
  pageId: string | null;
  status: ExperimentStatus;
  goalType: GoalType;
  goalPath: string | null;
  startedAt: string | null;
  winnerVariantId: string | null;
  variants: ExperimentVariant[];
}

export interface VariantInput {
  key: string;
  name: string;
  weight?: number;
  isControl?: boolean;
}

export interface ExperimentInput {
  name: string;
  description?: string;
  pageId?: string;
  goalType?: GoalType;
  goalPath?: string;
  variants: VariantInput[];
}

export interface VariantResult {
  variantId: string;
  key: string;
  name: string;
  isControl: boolean;
  exposures: number;
  conversions: number;
  rate: number;
  uplift: number | null;
  confidence: number | null;
}

export interface ExperimentResults {
  experimentId: string;
  status: string;
  goalType: string;
  totalExposures: number;
  totalConversions: number;
  variants: VariantResult[];
  leaderVariantId: string | null;
}

export const listExperimentsRequest = (): Promise<Experiment[]> =>
  request<Experiment[]>({ url: "/experiments", method: "GET" });

export const createExperimentRequest = (data: ExperimentInput): Promise<Experiment> =>
  request<Experiment>({ url: "/experiments", method: "POST", data });

export const updateExperimentRequest = (id: string, data: ExperimentInput): Promise<Experiment> =>
  request<Experiment>({ url: `/experiments/${id}`, method: "PUT", data });

export const deleteExperimentRequest = (id: string): Promise<{ id: string }> =>
  request<{ id: string }>({ url: `/experiments/${id}`, method: "DELETE" });

export const setExperimentStatusRequest = (
  id: string,
  status: ExperimentStatus,
  winnerVariantId?: string,
): Promise<Experiment> =>
  request<Experiment>({
    url: `/experiments/${id}/status`,
    method: "PUT",
    data: { status, ...(winnerVariantId ? { winnerVariantId } : {}) },
  });

export const experimentResultsRequest = (id: string): Promise<ExperimentResults> =>
  request<ExperimentResults>({ url: `/experiments/${id}/results`, method: "GET" });
