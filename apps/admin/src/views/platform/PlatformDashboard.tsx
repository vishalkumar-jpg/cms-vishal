import * as React from "react";
import { Link } from "react-router";
import {
  Globe,
  Users,
  FileText,
  CheckCircle2,
  FormInput,
  Inbox,
  Network,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { usePlatformOverview, usePlatformSites } from "./hooks/usePlatform";

/** Platform-admin dashboard: cross-tenant overview cards + recent sites. */
export const PlatformDashboard: React.FC = () => {
  const { data: overview, isLoading } = usePlatformOverview();
  const { data: sites = [] } = usePlatformSites();
  const recent = sites.slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Platform overview</h1>
        <p className="text-sm text-muted-foreground">
          Cross-tenant totals across every website on the platform.
        </p>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Sites" value={overview?.sites ?? 0} icon={Globe} to="/platform/sites" />
          <StatCard title="Users" value={overview?.users ?? 0} icon={Users} />
          <StatCard
            title="Pages"
            value={overview?.pages ?? 0}
            sub={`${overview?.publishedPages ?? 0} published`}
            icon={FileText}
          />
          <StatCard
            title="Published"
            value={overview?.publishedPages ?? 0}
            icon={CheckCircle2}
          />
          <StatCard title="Forms" value={overview?.forms ?? 0} icon={FormInput} />
          <StatCard title="Submissions" value={overview?.submissions ?? 0} icon={Inbox} />
          <StatCard title="Domains" value={overview?.domains ?? 0} icon={Network} />
        </div>
      )}

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Recent sites</h2>
          <Link
            to="/platform/sites"
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            All sites <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <Card>
          <CardContent className="p-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Site</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Pages</th>
                  <th className="px-4 py-2.5 font-medium">Members</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      No sites yet.
                    </td>
                  </tr>
                )}
                {recent.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.subdomain}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={s.status === "suspended" ? "destructive" : "success"}>
                        {s.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{s.counts.pages}</td>
                    <td className="px-4 py-3">{s.counts.members}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  title: string;
  value: number;
  sub?: string;
  icon: typeof Globe;
  to?: string;
}> = ({ title, value, sub, icon: Icon, to }) => {
  const body = (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{value}</div>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
  return to ? (
    <Link to={to} className="block transition-transform hover:-translate-y-0.5">
      {body}
    </Link>
  ) : (
    body
  );
};
