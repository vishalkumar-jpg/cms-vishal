import * as React from "react";
import { Button, Label, Textarea } from "@/components/ui";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

/**
 * B14 editorial workflow — shared UI atoms used by both the Pages and Blog
 * screens: the state badge, the "submit for review" reviewer picker, and the
 * "reject" note dialog. Presentational only (state/mutations live in the views).
 */

export type WorkflowState = "draft" | "in_review" | "approved" | "published";

export const WORKFLOW_LABELS: Record<WorkflowState, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  published: "Published",
};

const WORKFLOW_VARIANT: Record<WorkflowState, BadgeProps["variant"]> = {
  draft: "muted",
  in_review: "warning",
  approved: "default",
  published: "success",
};

/** A coloured pill for the current workflow state. */
export const WorkflowBadge: React.FC<{ state: WorkflowState }> = ({ state }) => (
  <Badge variant={WORKFLOW_VARIANT[state]}>{WORKFLOW_LABELS[state]}</Badge>
);

const NONE = "__none__";

export interface ReviewerOption {
  userId: string;
  label: string;
}

/** Submit-for-review dialog: optionally pick a reviewer, then submit. */
export const SubmitReviewDialog: React.FC<{
  open: boolean;
  title?: string;
  reviewers: ReviewerOption[];
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reviewerId?: string) => void;
}> = ({ open, title, reviewers, pending, onOpenChange, onSubmit }) => {
  const [reviewerId, setReviewerId] = React.useState<string>(NONE);

  React.useEffect(() => {
    if (open) setReviewerId(NONE);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit for review</DialogTitle>
          <DialogDescription>
            {title ? `"${title}" ` : "This content "}
            will move to <strong>In review</strong> and wait for an editor to approve it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>Reviewer (optional)</Label>
          <Select value={reviewerId} onValueChange={setReviewerId}>
            <SelectTrigger>
              <SelectValue placeholder="Anyone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Anyone (unassigned)</SelectItem>
              {reviewers.map((r) => (
                <SelectItem key={r.userId} value={r.userId}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit(reviewerId === NONE ? undefined : reviewerId)}
            disabled={pending}
          >
            Submit for review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** Reject dialog: a required note explaining why, returned to the author. */
export const RejectDialog: React.FC<{
  open: boolean;
  title?: string;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onReject: (note: string) => void;
}> = ({ open, title, pending, onOpenChange, onReject }) => {
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    if (open) setNote("");
  }, [open]);

  const trimmed = note.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject{title ? ` "${title}"` : ""}</DialogTitle>
          <DialogDescription>
            Send this back to the author as a draft with a note explaining what needs to change.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="reject-note">Reason</Label>
          <Textarea
            id="reject-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What needs to change before this can be approved?"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => onReject(trimmed)}
            disabled={pending || trimmed.length === 0}
          >
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
