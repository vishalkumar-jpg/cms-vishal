import * as React from "react";
import { BarChart3, Inbox } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useFormAnalytics } from "../hooks/useForms";
import type { Form } from "../types";

/** Render an unknown cell value as readable text. */
const renderCell = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg border border-border px-4 py-3">
    <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="mt-1 text-2xl font-semibold">{value}</div>
  </div>
);

/**
 * Submission analytics panel — totals, a daily bar sparkline, conversion (when
 * views were tracked), and a recent-submissions list with the submitted data.
 */
export const AnalyticsDialog: React.FC<{
  form: Form | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ form, open, onOpenChange }) => {
  const { data, isLoading, isError } = useFormAnalytics(open ? (form?.id ?? null) : null, 30);
  const columns = form?.fields ?? [];
  const maxCount = Math.max(1, ...(data?.series ?? []).map((s) => s.count));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Analytics{form ? ` — ${form.name}` : ""}</DialogTitle>
          <DialogDescription>Submission totals and recent activity.</DialogDescription>
        </DialogHeader>

        {isLoading && <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>}
        {isError && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Could not load analytics.
          </p>
        )}

        {data && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Total" value={String(data.total)} />
              <Stat label="Delivered" value={String(data.delivered)} />
              <Stat label="Spam" value={String(data.spam)} />
              <Stat
                label="Conversion"
                value={
                  data.conversionRate != null
                    ? `${(data.conversionRate * 100).toFixed(1)}%`
                    : data.views != null
                      ? "—"
                      : "n/a"
                }
              />
            </div>

            <div>
              <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <BarChart3 className="h-4 w-4" /> Last {data.windowDays} days
              </div>
              {data.series.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  No submissions in this window.
                </p>
              ) : (
                <div className="flex h-32 items-end gap-1 rounded-md border border-border p-3">
                  {data.series.map((pt) => (
                    <div
                      key={pt.date}
                      className="flex-1 rounded-t bg-primary/70"
                      style={{ height: `${Math.max(4, (pt.count / maxCount) * 100)}%` }}
                      title={`${pt.date}: ${pt.count}`}
                    />
                  ))}
                </div>
              )}
              {data.views != null && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.views} form view{data.views === 1 ? "" : "s"} tracked.
                </p>
              )}
            </div>

            <div>
              <div className="mb-2 text-sm font-medium">Recent submissions</div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      {columns.slice(0, 4).map((c) => (
                        <th key={c.name} className="px-4 py-3 font-medium">
                          {c.label || c.name}
                        </th>
                      ))}
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Submitted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.recent.length === 0 && (
                      <tr>
                        <td
                          colSpan={columns.slice(0, 4).length + 2}
                          className="px-4 py-10 text-center text-sm text-muted-foreground"
                        >
                          <Inbox className="mx-auto mb-2 h-6 w-6 opacity-40" />
                          No submissions yet.
                        </td>
                      </tr>
                    )}
                    {data.recent.map((sub) => (
                      <tr key={sub.id} className="hover:bg-muted/30">
                        {columns.slice(0, 4).map((c) => (
                          <td key={c.name} className="px-4 py-3">
                            {renderCell(sub.data[c.name])}
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          <Badge variant={sub.isSpam ? "destructive" : "muted"}>
                            {sub.isSpam ? "spam" : sub.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(sub.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
