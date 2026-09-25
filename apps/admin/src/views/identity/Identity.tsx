import { useState } from "react";
import { Fingerprint, RefreshCw } from "lucide-react";
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { useRebuild } from "./hooks/useIdentity";
import { VisitorsTab } from "./components/VisitorsTab";
import { IdentitiesTab } from "./components/IdentitiesTab";
import { CompaniesTab } from "./components/CompaniesTab";
import { ScoringRulesTab } from "./components/ScoringRulesTab";
import { Visitor360Drawer } from "./components/Visitor360Drawer";

/**
 * Identity center (Phase 3). The B2B intelligence hub over the analytics stream:
 * visitor profiles (with lead score), a Visitor-360 drill-in, known identities,
 * identified companies, and the lead-scoring-rule editor. A "Rebuild" action
 * enqueues the worker recompute (profiles + scores).
 */
export function Identity() {
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const rebuild = useRebuild();

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Fingerprint className="h-6 w-6 text-primary" />
            Identity
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visitor profiles, identity resolution, company identification and lead scoring — built
            from your first-party analytics.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => rebuild.mutate()}
          disabled={rebuild.isPending}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${rebuild.isPending ? "animate-spin" : ""}`} />
          Rebuild profiles
        </Button>
      </header>

      <Tabs defaultValue="visitors">
        <TabsList>
          <TabsTrigger value="visitors">Visitors</TabsTrigger>
          <TabsTrigger value="identities">Identities</TabsTrigger>
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="scoring">Scoring rules</TabsTrigger>
        </TabsList>

        <TabsContent value="visitors" className="mt-4">
          <VisitorsTab onOpenVisitor={setVisitorId} />
        </TabsContent>
        <TabsContent value="identities" className="mt-4">
          <IdentitiesTab />
        </TabsContent>
        <TabsContent value="companies" className="mt-4">
          <CompaniesTab />
        </TabsContent>
        <TabsContent value="scoring" className="mt-4">
          <ScoringRulesTab />
        </TabsContent>
      </Tabs>

      <Visitor360Drawer visitorId={visitorId} onClose={() => setVisitorId(null)} />
    </div>
  );
}
