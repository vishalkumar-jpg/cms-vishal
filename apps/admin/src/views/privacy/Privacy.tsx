import * as React from "react";
import { Search, Download, Trash2, AlertTriangle, ShieldQuestion } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui";
import { toast } from "@/components/ui/toaster";
import { useSiteStore } from "@/store/siteStore";
import {
  useConsentRecords,
  useDsarAudit,
  useDsarErase,
  useDsarExport,
  useDsarSummary,
} from "./hooks/usePrivacy";
import type { DsarSummary } from "./api/privacy.api";

/**
 * Privacy / DSAR screen (Privacy & Consent suite). A site_admin looks up a data
 * subject by email or visitorId → sees a summary of all data held → can EXPORT a
 * JSON of every row or ERASE/ANONYMIZE it across all tables (with a typed
 * confirm). Recent DSAR erasures + proof-of-consent records are shown below.
 */
export const Privacy: React.FC = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const [input, setInput] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");

  const summaryQ = useDsarSummary(query, query.length > 0);
  const exportM = useDsarExport();
  const eraseM = useDsarErase();
  const records = useConsentRecords();
  const dsarAudit = useDsarAudit();

  const runLookup = (e?: React.FormEvent): void => {
    e?.preventDefault();
    setQuery(input.trim());
  };

  const onExport = (): void => {
    if (!query) return;
    exportM.mutate(query, {
      onSuccess: (data) => {
        downloadJson(data, `dsar-${sanitizeName(query)}.json`);
        toast.success("Export downloaded");
      },
      onError: () => toast.error("Export failed"),
    });
  };

  const onErase = (): void => {
    if (!query) return;
    eraseM.mutate(query, {
      onSuccess: (res) => {
        const total = Object.values(res.deleted).reduce((a, b) => a + b, 0);
        toast.success(`Erased/anonymized ${total} record(s)`);
        setConfirmOpen(false);
        setConfirmText("");
        void summaryQ.refetch();
        void dsarAudit.refetch();
      },
      onError: () => toast.error("Erasure failed"),
    });
  };

  if (!siteId) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
        <Header />
        <Card className="mt-8">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Select a site to handle data requests.
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = summaryQ.data;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <Header />

      {/* Lookup box */}
      <Card>
        <CardHeader>
          <CardTitle>Look up a data subject</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={runLookup} className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Email address or visitorId"
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={input.trim().length === 0}>
              Look up
            </Button>
          </form>

          {query && summaryQ.isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Searching…</p>
          ) : null}
          {query && summaryQ.isError ? (
            <p className="mt-4 text-sm text-destructive">
              Lookup failed — check the query and try again.
            </p>
          ) : null}
          {summary ? <SummaryView summary={summary} /> : null}
        </CardContent>
      </Card>

      {/* Actions */}
      {summary ? (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={onExport} disabled={exportM.isPending}>
              <Download className="mr-2 h-4 w-4" />
              {exportM.isPending ? "Preparing…" : "Export JSON"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmText("");
                setConfirmOpen(true);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Erase / anonymize
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Recent DSAR erasures */}
      <Card>
        <CardHeader>
          <CardTitle>Recent data-request actions</CardTitle>
        </CardHeader>
        <CardContent>
          {dsarAudit.data && dsarAudit.data.rows.length > 0 ? (
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {dsarAudit.data.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.entityId ?? "—"}</td>
                    <td className="px-3 py-2">{r.actorEmail ?? r.actorId ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">No erasure requests yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Recent proof-of-consent */}
      <Card>
        <CardHeader>
          <CardTitle>Recent consent decisions</CardTitle>
        </CardHeader>
        <CardContent>
          {records.data && records.data.length > 0 ? (
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Visitor</th>
                  <th className="px-3 py-2">Analytics</th>
                  <th className="px-3 py-2">Marketing</th>
                  <th className="px-3 py-2">Method</th>
                  <th className="px-3 py-2">Policy</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.data.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.ts)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.visitorId ?? "—"}</td>
                    <td className="px-3 py-2">{r.analytics ? "yes" : "no"}</td>
                    <td className="px-3 py-2">{r.marketing ? "yes" : "no"}</td>
                    <td className="px-3 py-2">{r.method}</td>
                    <td className="px-3 py-2">{r.policyVersion ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">No consent records yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Erase confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Erase all data for this subject?
            </DialogTitle>
            <DialogDescription>
              This permanently deletes analytics events, profiles, conversions,
              audience memberships, form submissions and consent records, and
              anonymizes the identity. This cannot be undone. Type{" "}
              <span className="font-mono font-semibold">ERASE</span> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="ERASE"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onErase}
              disabled={confirmText !== "ERASE" || eraseM.isPending}
            >
              {eraseM.isPending ? "Erasing…" : "Erase permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Header: React.FC = () => (
  <div>
    <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
      <ShieldQuestion className="h-6 w-6" />
      Data requests (DSAR)
    </h1>
    <p className="mt-1 text-sm text-muted-foreground">
      Look up, export, and erase a person&apos;s data for GDPR access &amp;
      erasure requests.
    </p>
  </div>
);

const SummaryView: React.FC<{ summary: DsarSummary }> = ({ summary }) => {
  const rows = Object.entries(summary.counts);
  const total = rows.reduce((a, [, n]) => a + n, 0);
  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-lg border p-4 text-sm">
        <div>
          <span className="text-muted-foreground">Matched as: </span>
          <span className="font-medium">{summary.kind}</span>
        </div>
        {summary.identity ? (
          <div className="mt-1">
            <span className="text-muted-foreground">Identity: </span>
            <span className="font-medium">
              {summary.identity.name ? `${summary.identity.name} · ` : ""}
              {summary.identity.email}
            </span>
          </div>
        ) : null}
        {summary.visitorIds.length > 0 ? (
          <div className="mt-1">
            <span className="text-muted-foreground">Visitor ids: </span>
            <span className="font-mono text-xs">{summary.visitorIds.join(", ")}</span>
          </div>
        ) : null}
      </div>

      <div>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Table</th>
              <th className="px-3 py-2 text-right">Rows held</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(([table, n]) => (
              <tr key={table}>
                <td className="px-3 py-2">{table}</td>
                <td className="px-3 py-2 text-right font-medium">{n}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 text-right">{total}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function sanitizeName(q: string): string {
  return q.replace(/[^a-z0-9]+/gi, "-").slice(0, 40).toLowerCase();
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
