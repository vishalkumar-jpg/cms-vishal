import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWebhookDeliveries } from "../hooks/useDevelopers";
import type { Webhook } from "../types";

const statusVariant = (
  status: string,
): "success" | "warning" | "destructive" | "muted" => {
  if (status === "delivered") return "success";
  if (status === "dead_lettered" || status === "failed") return "destructive";
  if (status === "delivering" || status === "pending") return "warning";
  return "muted";
};

/** Read-only delivery log for one subscription (most-recent first). */
export const DeliveryLogDialog: React.FC<{
  webhook: Webhook | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ webhook, open, onOpenChange }) => {
  const { data: deliveries = [], isLoading, isError } = useWebhookDeliveries(
    open ? (webhook?.id ?? null) : null,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delivery log</DialogTitle>
          <DialogDescription className="truncate">{webhook?.url}</DialogDescription>
        </DialogHeader>
        <div className="max-h-96 overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="sticky top-0 bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Event</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Attempts</th>
                <th className="px-3 py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <EmptyRow text="Loading deliveries…" />}
              {isError && <EmptyRow text="Could not load deliveries." />}
              {!isLoading && !isError && deliveries.length === 0 && (
                <EmptyRow text="No deliveries yet. Send a test event." />
              )}
              {deliveries.map((d) => (
                <tr key={d.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <code className="text-xs">{d.event}</code>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{d.statusCode ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{d.attempts}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(d.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const EmptyRow: React.FC<{ text: string }> = ({ text }) => (
  <tr>
    <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
      {text}
    </td>
  </tr>
);
