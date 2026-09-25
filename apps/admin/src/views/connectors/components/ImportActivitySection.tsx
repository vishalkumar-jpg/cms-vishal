import * as React from "react";
import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  IMPORT_ACTIVITY_SECTION_TITLE,
  HUBSPOT_IMPORT_SCOPE_LABELS,
  IMPORT_RUN_STATUS_SUCCEEDED,
  IMPORT_RUN_STATUS_FAILED,
  IMPORT_RUN_STATUS_RUNNING,
} from "../constants";
import { formatConnectorDate } from "../lib/connector-display";
import { formatImportRunResultCounts } from "../lib/formatImportRunResults";
import type { ImportRun } from "../types";

const statusVariant = (status: string): "success" | "destructive" | "warning" | "muted" => {
  if (status === IMPORT_RUN_STATUS_SUCCEEDED) return "success";
  if (status === IMPORT_RUN_STATUS_FAILED) return "destructive";
  if (status === IMPORT_RUN_STATUS_RUNNING) return "warning";
  return "muted";
};

export const ImportActivitySection: React.FC<{
  runs: ImportRun[];
  isLoading: boolean;
  isError: boolean;
  /** When true, omits page-level spacing (e.g. inside connection details dialog). */
  embedded?: boolean;
}> = ({ runs, isLoading, isError, embedded = false }) => {
  let emptyText = "No import runs yet. Run an import from a connected account.";
  if (isLoading) emptyText = "Loading import activity…";
  else if (isError) emptyText = "Could not load import activity.";

  return (
    <section className={embedded ? "mt-4" : "mt-10"}>
      <h2 className="mb-3 text-sm font-medium text-foreground">{IMPORT_ACTIVITY_SECTION_TITLE}</h2>
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Platform</th>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">Scope</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Results</th>
                <th className="px-4 py-3 font-medium">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    <History className="mx-auto mb-2 h-6 w-6 opacity-40" />
                    {emptyText}
                  </td>
                </tr>
              )}
              {runs.map((run) => (
                <tr key={run.runId} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{run.connectorName}</td>
                  <td className="max-w-[10rem] truncate px-4 py-3 text-muted-foreground">
                    {run.accountLabel ?? run.accountId ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {HUBSPOT_IMPORT_SCOPE_LABELS[run.scope] ?? run.scope}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                    {run.errorMessage && (
                      <p className="mt-1 max-w-xs truncate text-xs text-destructive" title={run.errorMessage}>
                        {run.errorMessage}
                      </p>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {run.status === IMPORT_RUN_STATUS_SUCCEEDED
                      ? formatImportRunResultCounts(run.resultSummary)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatConnectorDate(run.startedAt) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
