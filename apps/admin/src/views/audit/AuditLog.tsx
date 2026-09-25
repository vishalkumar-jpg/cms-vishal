import * as React from "react";
import { ScrollText } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { useSiteStore } from "@/store/siteStore";
import { useAudit } from "./hooks/useAudit";
import type { AuditEvent } from "./api/audit.api";

const fmtWhen = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
};

const entityLabel = (e: AuditEvent): string =>
  [e.entityType, e.entityId].filter(Boolean).join(" · ") || "—";

const details = (e: AuditEvent): string => {
  if (!e.metadata || Object.keys(e.metadata).length === 0) return "—";
  return Object.entries(e.metadata)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(", ");
};

/** Read-only audit log for the active site, with action/entity filters + load-more. */
export const AuditLog: React.FC = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const [actionInput, setActionInput] = React.useState("");
  const [entityInput, setEntityInput] = React.useState("");
  // Applied filters (commit on submit/blur so we don't requery per keystroke).
  const [filters, setFilters] = React.useState<{ action?: string; entityType?: string }>({});

  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useAudit(filters);

  const rows: AuditEvent[] = React.useMemo(
    () => data?.pages.flatMap((p) => p.rows) ?? [],
    [data],
  );

  const applyFilters = (e: React.FormEvent): void => {
    e.preventDefault();
    setFilters({
      action: actionInput.trim() || undefined,
      entityType: entityInput.trim() || undefined,
    });
  };

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Read-only history of actions on this website.
        </p>
      </div>

      <form onSubmit={applyFilters} className="mb-4 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="audit-action">
            Action
          </label>
          <Input
            id="audit-action"
            value={actionInput}
            onChange={(e) => setActionInput(e.target.value)}
            placeholder="e.g. team.invite_created"
            className="w-64"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="audit-entity">
            Entity type
          </label>
          <Input
            id="audit-entity"
            value={entityInput}
            onChange={(e) => setEntityInput(e.target.value)}
            placeholder="e.g. site_invitation"
            className="w-56"
          />
        </div>
        <Button type="submit" variant="outline">
          Apply
        </Button>
      </form>

      <div className="-mx-4 overflow-x-auto rounded-lg border border-border px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Entity</th>
              <th className="px-4 py-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!siteId && <EmptyRow text="Select a site to view its audit log." />}
            {siteId && isLoading && <EmptyRow text="Loading audit log…" />}
            {siteId && isError && <EmptyRow text="Could not load the audit log." />}
            {siteId && !isLoading && !isError && rows.length === 0 && (
              <EmptyRow text="No audit events yet." />
            )}
            {rows.map((e) => (
              <tr key={e.id} className="align-top hover:bg-muted/30">
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {fmtWhen(e.createdAt)}
                </td>
                <td className="px-4 py-3">{e.actorEmail ?? e.actorId ?? "system"}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{e.action}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{entityLabel(e)}</td>
                <td className="max-w-xs truncate px-4 py-3 text-muted-foreground" title={details(e)}>
                  {details(e)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
};

const EmptyRow: React.FC<{ text: string }> = ({ text }) => (
  <tr>
    <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
      <ScrollText className="mx-auto mb-2 h-6 w-6 opacity-40" />
      {text}
    </td>
  </tr>
);
