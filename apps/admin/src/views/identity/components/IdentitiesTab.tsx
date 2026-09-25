import { useIdentities } from "../hooks/useIdentity";

const fmtDate = (iso: string): string => new Date(iso).toLocaleDateString();

/** A list of known identities (resolved emails) and their company. */
export function IdentitiesTab() {
  const { data, isLoading } = useIdentities();
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Company</th>
            <th className="px-3 py-2 font-medium">First seen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {isLoading && (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                Loading…
              </td>
            </tr>
          )}
          {!isLoading && (data ?? []).length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                No identities yet. They appear when a form submit (or an identify beacon) links an
                email to a visitor.
              </td>
            </tr>
          )}
          {(data ?? []).map((i) => (
            <tr key={i.id} className="hover:bg-muted/30">
              <td className="px-3 py-2 font-medium text-foreground">{i.primaryEmail}</td>
              <td className="px-3 py-2 text-muted-foreground">{i.name ?? "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {i.companyName ?? i.companyDomain ?? "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{fmtDate(i.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
