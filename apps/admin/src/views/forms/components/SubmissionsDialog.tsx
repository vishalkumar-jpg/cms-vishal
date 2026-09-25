import * as React from "react";
import {
  Download,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Search,
  X,
} from "lucide-react";
import { Button, Input } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { useSubmissions } from "../hooks/useForms";
import { downloadCsv, submissionsToCsv } from "../lib/csv";
import { SubmissionDetailDialog } from "./SubmissionDetailDialog";
import type { Form, FormField, FormSubmission, SubmissionFilters } from "../types";

const PAGE_SIZE = 20;

/** At most 4 field columns in the list to keep it readable; detail shows all. */
const listColumns = (fields: FormField[]): FormField[] => {
  const preferred = fields.filter((f) => ["email", "text", "phone"].includes(f.type));
  return (preferred.length ? preferred : fields).slice(0, 4);
};

/** Render an unknown cell value as readable text. */
const renderCell = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

/** A concise source label from utm/referrer meta. */
const sourceLabel = (sub: FormSubmission): string => {
  const utm = sub.meta?.utm as Record<string, unknown> | undefined;
  const src = utm?.source ?? utm?.utm_source;
  if (typeof src === "string" && src) return src;
  if (sub.meta?.referrer) {
    try {
      return new URL(sub.meta.referrer).hostname;
    } catch {
      return sub.meta.referrer;
    }
  }
  return "direct";
};

const DEFAULT_FILTERS: SubmissionFilters = {
  spam: "hide",
  read: "all",
  from: null,
  to: null,
  q: "",
};

export const SubmissionsDialog: React.FC<{
  form: Form | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ form, open, onOpenChange }) => {
  const [page, setPage] = React.useState(1);
  const [filters, setFilters] = React.useState<SubmissionFilters>(DEFAULT_FILTERS);
  const [qInput, setQInput] = React.useState("");
  const [detail, setDetail] = React.useState<FormSubmission | null>(null);

  // Reset when a different form is opened.
  React.useEffect(() => {
    if (open) {
      setPage(1);
      setFilters(DEFAULT_FILTERS);
      setQInput("");
    }
  }, [open, form?.id]);

  // Debounce the text search into the filter (and reset to page 1).
  React.useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.q === qInput ? f : { ...f, q: qInput }));
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const patch = (p: Partial<SubmissionFilters>): void => {
    setFilters((f) => ({ ...f, ...p }));
    setPage(1);
  };

  const { data, isLoading, isError } = useSubmissions(
    open ? (form?.id ?? null) : null,
    page,
    PAGE_SIZE,
    filters,
  );

  const allFields = form?.fields ?? [];
  const columns = listColumns(allFields);
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const unread = data?.unread ?? 0;
  const spamCount = data?.spam ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const colSpan = columns.length + 4;

  const onExport = (): void => {
    if (rows.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    const csv = submissionsToCsv(allFields, rows);
    const name = (form?.name ?? "submissions").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    downloadCsv(`${name}-page-${page}.csv`, csv);
    toast.success(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submissions{form ? ` — ${form.name}` : ""}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <span>{total} shown</span>
            <span aria-hidden>·</span>
            <Badge variant="success">{unread} unread</Badge>
            <Badge variant={spamCount ? "destructive" : "muted"}>{spamCount} spam</Badge>
          </DialogDescription>
        </DialogHeader>

        {/* Filter bar */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search values…"
              className="pl-9"
            />
          </div>

          <Select value={filters.spam} onValueChange={(v) => patch({ spam: v as SubmissionFilters["spam"] })}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hide">Hide spam</SelectItem>
              <SelectItem value="only">Only spam</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.read} onValueChange={(v) => patch({ read: v as SubmissionFilters["read"] })}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
              <SelectItem value="read">Read</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="date"
            aria-label="From date"
            value={filters.from ?? ""}
            onChange={(e) => patch({ from: e.target.value || null })}
            className="w-[150px]"
          />
          <Input
            type="date"
            aria-label="To date"
            value={filters.to ?? ""}
            onChange={(e) => patch({ to: e.target.value || null })}
            className="w-[150px]"
          />

          <Button variant="ghost" size="sm" onClick={() => { setFilters(DEFAULT_FILTERS); setQInput(""); setPage(1); }}>
            <X className="mr-1 h-4 w-4" /> Reset
          </Button>

          <Button variant="outline" size="sm" onClick={onExport} disabled={rows.length === 0}>
            <Download className="mr-1.5 h-4 w-4" /> Export CSV
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {columns.map((c) => (
                  <th key={c.name} className="px-4 py-3 font-medium">
                    {c.label || c.name}
                  </th>
                ))}
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <EmptyRow colSpan={colSpan} text="Loading submissions…" />}
              {isError && <EmptyRow colSpan={colSpan} text="Could not load submissions." />}
              {!isLoading && !isError && rows.length === 0 && (
                <EmptyRow colSpan={colSpan} text="No submissions match these filters." />
              )}
              {rows.map((sub) => {
                const isUnread = !sub.isRead && !sub.isSpam;
                return (
                  <tr
                    key={sub.id}
                    className={`cursor-pointer hover:bg-muted/30 ${isUnread ? "font-medium" : ""}`}
                    onClick={() => setDetail(sub)}
                  >
                    {columns.map((c) => (
                      <td key={c.name} className="px-4 py-3">
                        {renderCell(sub.data[c.name])}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-muted-foreground">{sourceLabel(sub)}</td>
                    <td className="px-4 py-3">
                      {sub.isSpam ? (
                        <Badge variant="destructive">spam</Badge>
                      ) : isUnread ? (
                        <Badge variant="success">unread</Badge>
                      ) : (
                        <Badge variant="muted">read</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(sub.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">View</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>

      <SubmissionDetailDialog
        formId={form?.id ?? null}
        fields={allFields}
        submission={detail}
        open={!!detail}
        onOpenChange={(o) => {
          if (!o) setDetail(null);
        }}
      />
    </Dialog>
  );
};

const EmptyRow: React.FC<{ colSpan: number; text: string }> = ({ colSpan, text }) => (
  <tr>
    <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-muted-foreground">
      <Inbox className="mx-auto mb-2 h-6 w-6 opacity-40" />
      {text}
    </td>
  </tr>
);
