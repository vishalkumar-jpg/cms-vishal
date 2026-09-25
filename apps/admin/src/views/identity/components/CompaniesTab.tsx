import { Badge } from "@/components/ui";
import { useCompanies } from "../hooks/useIdentity";

/**
 * Identified companies (by email domain). industry/size are an enrichment seam —
 * shown when present, otherwise a muted "—" (no external enrichment is called).
 */
export function CompaniesTab() {
  const { data, isLoading } = useCompanies();
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Domain</th>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Industry</th>
            <th className="px-3 py-2 font-medium">Size</th>
            <th className="px-3 py-2 text-right font-medium">People</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {isLoading && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                Loading…
              </td>
            </tr>
          )}
          {!isLoading && (data ?? []).length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                No companies yet. A business-domain email (not gmail/outlook/…) creates one.
              </td>
            </tr>
          )}
          {(data ?? []).map((c) => (
            <tr key={c.id} className="hover:bg-muted/30">
              <td className="px-3 py-2 font-medium text-foreground">{c.domain}</td>
              <td className="px-3 py-2 text-muted-foreground">{c.name ?? "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {c.industry ?? <span className="italic opacity-60">enrichment seam</span>}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{c.size ?? "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                <Badge variant="muted">{c.people}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
