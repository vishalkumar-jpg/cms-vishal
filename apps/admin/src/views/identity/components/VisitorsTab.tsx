import { useState } from "react";
import { Badge, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { useVisitors } from "../hooks/useIdentity";
import type { VisitorsQuery } from "../api/identity.api";

const fmtDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";

/** The visitors table: score / identity / stats / source, with a drill-in. */
export function VisitorsTab({ onOpenVisitor }: { onOpenVisitor: (id: string) => void }) {
  const [sort, setSort] = useState<NonNullable<VisitorsQuery["sort"]>>("score");
  const [identified, setIdentified] = useState(false);
  const { data, isLoading } = useVisitors({ sort, identified, limit: 100 });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score">Sort: Lead score</SelectItem>
            <SelectItem value="lastSeen">Sort: Last seen</SelectItem>
            <SelectItem value="pageviews">Sort: Pageviews</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={identified ? "default" : "outline"}
          size="sm"
          onClick={() => setIdentified((v) => !v)}
        >
          Identified only
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Visitor</th>
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 text-right font-medium">Score</th>
              <th className="px-3 py-2 text-right font-medium">Sessions</th>
              <th className="px-3 py-2 text-right font-medium">Pageviews</th>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium">Last seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && (data ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  No visitor profiles yet. Run “Rebuild profiles” after some traffic.
                </td>
              </tr>
            )}
            {(data ?? []).map((v) => (
              <tr
                key={v.id}
                className="cursor-pointer hover:bg-muted/30"
                onClick={() => onOpenVisitor(v.id)}
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {v.email ?? v.visitorId}
                    </span>
                    {v.identified && (
                      <Badge variant="success" className="text-[10px]">
                        Identified
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{v.companyName ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <Badge variant={v.score >= 10 ? "warning" : "muted"}>{v.score}</Badge>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{v.sessions}</td>
                <td className="px-3 py-2 text-right tabular-nums">{v.pageviews}</td>
                <td className="px-3 py-2 text-muted-foreground">{v.lastSource ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{fmtDate(v.lastSeen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
