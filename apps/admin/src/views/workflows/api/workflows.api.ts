import { request } from "@/services/AxiosService";

/**
 * Workflows API (Phase 5). Header-scoped to the active site (X-Site-Id). CRUD
 * over workflows + ordered actions, activate/pause, a runs reader, and a dry-run
 * test.
 */

export type WorkflowTriggerType =
  | "audience_enters"
  | "form_submitted"
  | "score_threshold"
  | "page_visited";

export type WorkflowActionType =
  | "send_webhook"
  | "send_email"
  | "add_to_audience"
  | "add_tag"
  | "adjust_score"
  | "wait"
  | "enqueue_webhook_event";

export interface WorkflowTrigger {
  type: WorkflowTriggerType;
  config?: Record<string, unknown>;
}

export interface WorkflowAction {
  id?: string;
  order?: number;
  type: WorkflowActionType;
  config?: Record<string, unknown>;
}

export interface Workflow {
  id: string;
  name: string;
  status: "active" | "paused";
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
  recentRuns?: number;
  createdAt: string;
}

export interface WorkflowInput {
  name: string;
  status?: "active" | "paused";
  trigger: WorkflowTrigger;
  actions: Array<{ type: WorkflowActionType; config?: Record<string, unknown> }>;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  subjectType: string;
  subjectId: string;
  status: string;
  stepIndex: number;
  startedAt: string | null;
  finishedAt: string | null;
  log: Array<{ at: string; step: number; type: string; ok: boolean; detail?: string }>;
  createdAt: string;
}

export interface WorkflowTestResult {
  workflowId: string;
  subject: { visitorId: string };
  plan: Array<{ step: number; type: string; description: string }>;
}

export const listWorkflowsRequest = (): Promise<Workflow[]> =>
  request<Workflow[]>({ url: "/workflows", method: "GET" });

export const createWorkflowRequest = (data: WorkflowInput): Promise<Workflow> =>
  request<Workflow>({ url: "/workflows", method: "POST", data });

export const updateWorkflowRequest = (id: string, data: WorkflowInput): Promise<Workflow> =>
  request<Workflow>({ url: `/workflows/${id}`, method: "PUT", data });

export const deleteWorkflowRequest = (id: string): Promise<{ id: string }> =>
  request<{ id: string }>({ url: `/workflows/${id}`, method: "DELETE" });

export const setWorkflowStatusRequest = (id: string, status: "active" | "paused"): Promise<Workflow> =>
  request<Workflow>({ url: `/workflows/${id}/status`, method: "PUT", data: { status } });

export const listWorkflowRunsRequest = (id: string): Promise<WorkflowRun[]> =>
  request<WorkflowRun[]>({ url: `/workflows/${id}/runs`, method: "GET" });

export const testWorkflowRequest = (id: string, visitorId?: string): Promise<WorkflowTestResult> =>
  request<WorkflowTestResult>({ url: `/workflows/${id}/test`, method: "POST", data: { visitorId } });
