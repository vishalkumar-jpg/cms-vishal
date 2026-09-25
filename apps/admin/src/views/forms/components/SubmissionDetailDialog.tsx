import * as React from "react";
import { Link } from "react-router";
import { CheckCheck, MailOpen, ShieldAlert, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { useTriageSubmission } from "../hooks/useForms";
import type { FormField, FormSubmission } from "../types";

/** Render an unknown value as readable text. */
const renderValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid grid-cols-3 gap-3 border-b border-border/60 px-1 py-2 text-sm last:border-0">
    <div className="col-span-1 font-medium text-muted-foreground">{label}</div>
    <div className="col-span-2 break-words whitespace-pre-wrap">{children}</div>
  </div>
);

/**
 * Full-detail view for a single submission: every field (label → value), the
 * captured meta (ip/ua/referrer/utm), timestamps, a Visitor 360 link when the
 * submission resolved to a visitor, plus spam/read triage actions.
 */
export const SubmissionDetailDialog: React.FC<{
  formId: string | null;
  fields: FormField[];
  submission: FormSubmission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ formId, fields, submission, open, onOpenChange }) => {
  const triage = useTriageSubmission(formId);

  const doTriage = (payload: { isSpam?: boolean; isRead?: boolean }, label: string): void => {
    if (!submission) return;
    triage.mutate(
      { submissionId: submission.id, payload },
      {
        onSuccess: () => toast.success(label),
        onError: () => toast.error("Triage failed"),
      },
    );
  };

  const meta = submission?.meta;
  const utm = meta?.utm && Object.keys(meta.utm).length > 0 ? meta.utm : null;
  const visitorId = meta?.visitorId ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Submission
            {submission?.isSpam && <Badge variant="destructive">spam</Badge>}
            {submission && !submission.isRead && !submission.isSpam && (
              <Badge variant="success">unread</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {submission ? new Date(submission.createdAt).toLocaleString() : ""}
          </DialogDescription>
        </DialogHeader>

        {submission && (
          <>
            {/* Triage actions */}
            <div className="mb-2 flex flex-wrap gap-2">
              {submission.isSpam ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={triage.isPending}
                  onClick={() => doTriage({ isSpam: false }, "Marked not spam")}
                >
                  <ShieldCheck className="mr-1.5 h-4 w-4" /> Not spam
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={triage.isPending}
                  onClick={() => doTriage({ isSpam: true }, "Marked as spam")}
                >
                  <ShieldAlert className="mr-1.5 h-4 w-4" /> Mark spam
                </Button>
              )}
              {submission.isRead ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={triage.isPending}
                  onClick={() => doTriage({ isRead: false }, "Marked unread")}
                >
                  <MailOpen className="mr-1.5 h-4 w-4" /> Mark unread
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={triage.isPending}
                  onClick={() => doTriage({ isRead: true }, "Marked read")}
                >
                  <CheckCheck className="mr-1.5 h-4 w-4" /> Mark read
                </Button>
              )}
              {visitorId && (
                <Button asChild size="sm" variant="outline">
                  <Link to={`/identity?visitor=${encodeURIComponent(visitorId)}`}>
                    <User className="mr-1.5 h-4 w-4" /> View Visitor 360
                  </Link>
                </Button>
              )}
            </div>

            {/* Fields */}
            <section className="rounded-lg border border-border p-2">
              <h3 className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Fields
              </h3>
              {fields.length === 0 && (
                <p className="px-1 py-2 text-sm text-muted-foreground">
                  This form has no defined fields.
                </p>
              )}
              {fields.map((f) => (
                <Row key={f.name} label={f.label || f.name}>
                  {renderValue(submission.data[f.name])}
                </Row>
              ))}
              {/* Any extra keys present in data but not in the field schema. */}
              {Object.keys(submission.data)
                .filter((k) => !fields.some((f) => f.name === k))
                .map((k) => (
                  <Row key={k} label={k}>
                    {renderValue(submission.data[k])}
                  </Row>
                ))}
            </section>

            {/* Meta */}
            <section className="mt-3 rounded-lg border border-border p-2">
              <h3 className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Source &amp; meta
              </h3>
              <Row label="Delivery status">{submission.status}</Row>
              <Row label="IP">{renderValue(meta?.ip)}</Row>
              <Row label="User agent">{renderValue(meta?.ua)}</Row>
              <Row label="Referrer">{renderValue(meta?.referrer)}</Row>
              {meta?.pageUrl && <Row label="Page URL">{renderValue(meta.pageUrl)}</Row>}
              {utm &&
                Object.entries(utm).map(([k, v]) => (
                  <Row key={k} label={`utm.${k}`}>
                    {renderValue(v)}
                  </Row>
                ))}
              <Row label="Submitted at">{new Date(submission.createdAt).toLocaleString()}</Row>
              <Row label="Submission ID">{submission.id}</Row>
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
