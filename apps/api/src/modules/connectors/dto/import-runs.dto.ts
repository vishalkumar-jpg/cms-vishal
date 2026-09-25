import type {
  ImportRunResultSummary,
  ImportRunStatus,
} from "@database/schema/import-runs.schema";

export interface ImportRunDto {
  runId: string;
  connectionId: string;
  connectorId: string;
  connectorName: string;
  accountId: string | null;
  accountLabel: string | null;
  scope: string;
  status: ImportRunStatus;
  startedAt: string;
  completedAt: string | null;
  resultSummary: ImportRunResultSummary;
  errorMessage: string | null;
}

export interface ConnectorImportRunResponseDto extends ImportRunResultSummary {
  runId: string;
}
