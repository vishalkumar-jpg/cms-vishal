import * as React from "react";
import type { AxiosError } from "axios";
import { Download, FileJson, KeyRound, Loader2, PlugZap } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import { useSiteStore } from "@/store/siteStore";
import {
  usePreviewHubspot,
  useRunHubspotExport,
  useRunHubspotImport,
} from "./hooks/useHubspotImport";
import type { HubspotExportItem, HubspotPreview, ImportSummary } from "./types";

/** Pull a human-readable message out of an Axios error envelope. */
const errMessage = (e: unknown, fallback: string): string => {
  const ax = e as AxiosError<{ message?: string }>;
  return ax?.response?.data?.message ?? fallback;
};

/**
 * Import from HubSpot (backlog #28). Two paths:
 *  - Live: paste a HubSpot private-app token → preview discovered pages/posts →
 *    pick which to import → import as OB-CMS drafts.
 *  - Offline: paste/upload a HubSpot export JSON array → import directly.
 * The token is kept in component state only — never localStorage.
 */
export const Import: React.FC = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);

  const [token, setToken] = React.useState("");
  const [preview, setPreview] = React.useState<HubspotPreview | null>(null);
  const [selectedPages, setSelectedPages] = React.useState<Set<string>>(new Set());
  const [selectedPosts, setSelectedPosts] = React.useState<Set<string>>(new Set());
  const [summary, setSummary] = React.useState<ImportSummary | null>(null);
  const [exportJson, setExportJson] = React.useState("");

  const previewMut = usePreviewHubspot();
  const runMut = useRunHubspotImport();
  const exportMut = useRunHubspotExport();

  const toggle = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const onPreview = (): void => {
    setSummary(null);
    previewMut.mutate(
      { token },
      {
        onSuccess: (data) => {
          setPreview(data);
          setSelectedPages(new Set(data.pages.map((p) => p.hsId)));
          setSelectedPosts(new Set(data.posts.map((p) => p.hsId)));
          toast.success(`Found ${data.pages.length} pages and ${data.posts.length} posts`);
        },
        onError: (e) => toast.error(errMessage(e, "Could not connect to HubSpot")),
      },
    );
  };

  const onImport = (): void => {
    runMut.mutate(
      { token, pageIds: [...selectedPages], postIds: [...selectedPosts] },
      {
        onSuccess: (data) => {
          setSummary(data);
          toast.success(`Imported ${data.importedPages} pages, ${data.importedPosts} posts`);
        },
        onError: (e) => toast.error(errMessage(e, "Import failed")),
      },
    );
  };

  const onRunExport = (): void => {
    let items: HubspotExportItem[];
    try {
      const parsed = JSON.parse(exportJson) as unknown;
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array");
      items = parsed as HubspotExportItem[];
    } catch (e) {
      toast.error((e as Error).message || "Invalid JSON");
      return;
    }
    exportMut.mutate(
      { items },
      {
        onSuccess: (data) => {
          setSummary(data);
          toast.success(`Imported ${data.importedPages} pages, ${data.importedPosts} posts`);
        },
        onError: (e) => toast.error(errMessage(e, "Import failed")),
      },
    );
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    void file.text().then(setExportJson);
  };

  const selectedCount = selectedPages.size + selectedPosts.size;

  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Import from HubSpot</h1>
        <p className="text-sm text-muted-foreground">
          Bring your existing HubSpot CMS pages and blog posts into OB-CMS as drafts.
        </p>
      </div>

      {!siteId && (
        <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
          Select a site first to import content into it.
        </div>
      )}

      {siteId && (
        <div className="space-y-8">
          {/* -- Live connect -------------------------------------------------- */}
          <section className="rounded-lg border border-border p-5">
            <div className="mb-3 flex items-center gap-2">
              <PlugZap className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Connect to HubSpot</h2>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="hs-token">Private-app access token</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="hs-token"
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="pat-na1-…"
                    className="pl-9"
                    autoComplete="off"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Needs the <code>cms.pages.read</code> and <code>content</code> scopes. The token is
                  used for this request only and never stored.
                </p>
              </div>
              <Button onClick={onPreview} disabled={token.length < 8 || previewMut.isPending}>
                {previewMut.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <PlugZap className="mr-1.5 h-4 w-4" />
                )}
                Connect &amp; preview
              </Button>
            </div>
          </section>

          {/* -- Selectable list ---------------------------------------------- */}
          {preview && (
            <section className="rounded-lg border border-border p-5">
              <h2 className="mb-3 text-sm font-semibold">Choose what to import</h2>
              <ItemGroup
                title="Pages"
                items={preview.pages}
                selected={selectedPages}
                onToggle={(id) => setSelectedPages((s) => toggle(s, id))}
              />
              <ItemGroup
                title="Blog posts"
                items={preview.posts}
                selected={selectedPosts}
                onToggle={(id) => setSelectedPosts((s) => toggle(s, id))}
              />
              <Button
                className="mt-4"
                onClick={onImport}
                disabled={selectedCount === 0 || runMut.isPending}
              >
                {runMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Import selected ({selectedCount})
              </Button>
            </section>
          )}

          {/* -- Offline export fallback -------------------------------------- */}
          <section className="rounded-lg border border-border p-5">
            <div className="mb-3 flex items-center gap-2">
              <FileJson className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Or import an export file (no token)</h2>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              Paste or upload a JSON array of{" "}
              <code>{`{ name, slug?, html, metaDescription? }`}</code>. Add{" "}
              <code>{`"type": "post"`}</code> to an item to import it as a blog post.
            </p>
            <textarea
              value={exportJson}
              onChange={(e) => setExportJson(e.target.value)}
              placeholder='[{ "name": "About Us", "slug": "about-imported", "html": "<h1>About</h1>", "metaDescription": "x" }]'
              className="h-40 w-full resize-y rounded-md border border-border bg-background p-3 font-mono text-xs"
            />
            <div className="mt-3 flex items-center gap-3">
              <Button
                variant="outline"
                onClick={onRunExport}
                disabled={!exportJson.trim() || exportMut.isPending}
              >
                {exportMut.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-1.5 h-4 w-4" />
                )}
                Import export JSON
              </Button>
              <label className="cursor-pointer text-xs text-muted-foreground underline">
                Upload .json file
                <input type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
              </label>
            </div>
          </section>

          {/* -- Result summary ----------------------------------------------- */}
          {summary && (
            <section className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-5">
              <h2 className="mb-2 text-sm font-semibold">Import complete</h2>
              <p className="text-sm">
                Imported <strong>{summary.importedPages}</strong> page(s) and{" "}
                <strong>{summary.importedPosts}</strong> post(s) as drafts.
              </p>
              {summary.skipped.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Skipped {summary.skipped.length}:
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {summary.skipped.map((s, i) => (
                      <li key={i}>
                        <span className="font-medium">{s.name}</span> — {s.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
};

const ItemGroup: React.FC<{
  title: string;
  items: { hsId: string; name: string; slug: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}> = ({ title, items, selected, onToggle }) => {
  if (items.length === 0) {
    return (
      <div className="mb-3">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <p className="text-xs text-muted-foreground">None found.</p>
      </div>
    );
  }
  return (
    <div className="mb-4">
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title} <Badge variant="muted">{items.length}</Badge>
      </p>
      <ul className="divide-y divide-border rounded-md border border-border">
        {items.map((it) => (
          <li key={it.hsId} className="flex items-center gap-3 px-3 py-2">
            <input
              type="checkbox"
              checked={selected.has(it.hsId)}
              onChange={() => onToggle(it.hsId)}
              className="h-4 w-4"
            />
            <span className="flex-1 truncate text-sm">{it.name}</span>
            {it.slug && <span className="truncate text-xs text-muted-foreground">/{it.slug}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};
