import { Link } from "react-router";
import { FileText, Newspaper, Image as ImageIcon, FormInput, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@/components/ui";
import { useSiteStore } from "@/store/siteStore";
import { usePages } from "@/views/pages/hooks/usePages";
import { useActiveSite } from "@/views/sites/hooks/useSites";
import { usePosts } from "@/views/blog/hooks/useBlog";
import { useMediaList } from "@/views/media/hooks/useMedia";
import { useForms } from "@/views/forms/hooks/useForms";

/** Site overview dashboard — live counts for the active site. */
export const Dashboard = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const { activeSite } = useActiveSite();
  const { data: pages = [] } = usePages(siteId);
  const { data: posts = [] } = usePosts();
  const { data: media = [] } = useMediaList();
  const { data: forms = [] } = useForms();

  const published = pages.filter((p) => p.status === "published").length;

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {activeSite ? activeSite.name : "Select a site to get started."}
          </p>
        </div>
        <Button asChild>
          <Link to="/pages">Manage pages </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Pages" value={pages.length} sub={`${published} published`} to="/pages" icon={FileText} />
        <StatCard title="Blog posts" value={posts.length} to="/blog" icon={Newspaper} />
        <StatCard title="Media assets" value={media.length} to="/media" icon={ImageIcon} />
        <StatCard title="Forms" value={forms.length} to="/forms" icon={FormInput} />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <QuickLink to="/pages" label="Create a page" />
          <QuickLink to="/theme" label="Edit the theme" />
          <QuickLink to="/navigation" label="Update navigation" />
        </div>
      </div>
    </div>
  );
};

const StatCard = ({
  title,
  value,
  sub,
  to,
  icon: Icon,
}: {
  title: string;
  value: number;
  sub?: string;
  to: string;
  icon: typeof FileText;
}) => (
  <Link to={to} className="block transition-transform hover:-translate-y-0.5">
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
  </Link>
);

const QuickLink = ({ to, label }: { to: string; label: string }) => (
  <Link
    to={to}
    className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
  >
    {label}
    <ArrowRight className="h-4 w-4 text-muted-foreground" />
  </Link>
);
