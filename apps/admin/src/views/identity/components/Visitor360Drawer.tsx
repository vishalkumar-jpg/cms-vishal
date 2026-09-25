import {
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import { useVisitor } from "../hooks/useIdentity";

const fmtTs = (iso: string): string => new Date(iso).toLocaleString();

/** Visitor 360 — profile stats, identity + company, and the event timeline. */
export function Visitor360Drawer({
  visitorId,
  onClose,
}: {
  visitorId: string | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useVisitor(visitorId);

  return (
    <Dialog open={!!visitorId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {data?.identity?.email ?? data?.profile.visitorId ?? "Visitor"}
          </DialogTitle>
        </DialogHeader>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {data && (
          <div className="space-y-5">
            {/* Stat cards */}
            <div className="grid grid-cols-4 gap-3">
              <Stat label="Score" value={data.profile.score} accent />
              <Stat label="Sessions" value={data.profile.sessions} />
              <Stat label="Pageviews" value={data.profile.pageviews} />
              <Stat label="Source" value={data.profile.lastSource ?? "—"} />
            </div>

            {/* Identity + company */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                  Identity
                </div>
                {data.identity ? (
                  <div className="text-sm">
                    <div className="font-medium text-foreground">{data.identity.email}</div>
                    {data.identity.name && (
                      <div className="text-muted-foreground">{data.identity.name}</div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Anonymous</div>
                )}
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                  Company
                </div>
                {data.company ? (
                  <div className="text-sm">
                    <div className="font-medium text-foreground">
                      {data.company.name ?? data.company.domain}
                    </div>
                    <div className="text-muted-foreground">
                      {data.company.industry ?? "—"} · {data.company.size ?? "—"}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">—</div>
                )}
              </div>
            </div>

            {/* Top paths */}
            {data.profile.topPaths.length > 0 && (
              <div>
                <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                  Top paths
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.profile.topPaths.map((p) => (
                    <Badge key={p.path} variant="muted">
                      {p.path} · {p.views}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div>
              <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                Timeline ({data.timeline.length})
              </div>
              <ol className="space-y-1.5 border-l border-border pl-4">
                {data.timeline.map((e, i) => (
                  <li key={i} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                    <span className="text-foreground">{e.type}</span>{" "}
                    <span className="text-muted-foreground">{e.path}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {e.source} · {e.device} · {fmtTs(e.ts)}
                    </span>
                  </li>
                ))}
                {data.timeline.length === 0 && (
                  <li className="text-sm text-muted-foreground">No events.</li>
                )}
              </ol>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${accent ? "text-primary" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}
