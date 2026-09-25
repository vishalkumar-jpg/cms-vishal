import {
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import { useAudienceMembers } from "../hooks/useAudiences";
import type { Audience } from "../api/audiences.api";

const fmtDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString() : "—";

/** The materialized member list for an audience. */
export function MembersDrawer({
  audience,
  onClose,
}: {
  audience: Audience | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useAudienceMembers(audience?.id ?? null);

  return (
    <Dialog open={!!audience} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{audience?.name} — members</DialogTitle>
        </DialogHeader>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!isLoading && (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Visitor / email</th>
                  <th className="px-3 py-2 font-medium">Company</th>
                  <th className="px-3 py-2 text-right font-medium">Score</th>
                  <th className="px-3 py-2 font-medium">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                      No members. Recompute after saving rules and rebuilding profiles.
                    </td>
                  </tr>
                )}
                {(data ?? []).map((m) => (
                  <tr key={m.visitorProfileId} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium text-foreground">
                      {m.email ?? m.visitorId}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{m.companyName ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <Badge variant={m.score >= 10 ? "warning" : "muted"}>{m.score}</Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(m.lastSeen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
