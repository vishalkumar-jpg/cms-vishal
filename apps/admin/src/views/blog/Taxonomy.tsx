import * as React from "react";
import { Plus, Pencil, Trash2, Tag as TagIcon, Check, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { useConfirm } from "@/components/ui/confirm-provider";
import { DELETE_CONFIRM_LABEL } from "@/components/ui/confirm-labels";
import { useSiteStore } from "@/store/siteStore";
import {
  useTerms,
  useCreateTerm,
  useUpdateTerm,
  useDeleteTerm,
} from "./hooks/useBlog";
import type { TermSummary } from "./types";

type Kind = "category" | "tag";

/**
 * Taxonomy manager — list/create/rename/delete categories & tags (post_terms).
 * Renaming/deleting applies across every post that uses the term.
 */
export const Taxonomy: React.FC = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Categories &amp; Tags</h1>
        <p className="text-sm text-muted-foreground">
          Manage the taxonomy used to organise and filter blog posts.
        </p>
      </div>
      {!siteId ? (
        <p className="text-sm text-muted-foreground">Select a site to manage its taxonomy.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <TermColumn kind="category" title="Categories" />
          <TermColumn kind="tag" title="Tags" />
        </div>
      )}
    </div>
  );
};

const TermColumn: React.FC<{ kind: Kind; title: string }> = ({ kind, title }) => {
  const { data: terms = [], isLoading } = useTerms(kind);
  const create = useCreateTerm();
  const [name, setName] = React.useState("");

  const onCreate = (): void => {
    const clean = name.trim();
    if (!clean) return;
    create.mutate(
      { kind, name: clean },
      {
        onSuccess: () => {
          setName("");
          toast.success(`${title.replace(/s$/, "")} created`);
        },
        onError: () => toast.error("Could not create"),
      },
    );
  };

  return (
    <section className="rounded-lg border border-border">
      <header className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
        <TagIcon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">{title}</h2>
        <Badge variant="muted" className="ml-auto">
          {terms.length}
        </Badge>
      </header>

      <div className="flex gap-2 border-b border-border p-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCreate();
            }
          }}
          placeholder={`New ${title.toLowerCase().replace(/s$/, "")}…`}
        />
        <Button size="icon" variant="outline" onClick={onCreate} disabled={create.isPending}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ul className="divide-y divide-border">
        {isLoading && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</li>}
        {!isLoading && terms.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">None yet.</li>
        )}
        {terms.map((t) => (
          <TermRow key={`${t.kind}:${t.slug}`} term={t} />
        ))}
      </ul>
    </section>
  );
};

const TermRow: React.FC<{ term: TermSummary }> = ({ term }) => {
  const update = useUpdateTerm();
  const del = useDeleteTerm();
  const confirm = useConfirm();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(term.name);

  const doDelete = (): void => {
    void (async () => {
      const ok = await confirm({
        title: `Delete "${term.name}"?`,
        description: `This ${term.kind} will be removed from all ${term.count} post${term.count === 1 ? "" : "s"} that use it. This action cannot be undone.`,
        confirmLabel: DELETE_CONFIRM_LABEL,
        destructive: true,
      });
      if (!ok) return;
      del.mutate(
        { kind: term.kind, slug: term.slug },
        {
          onSuccess: () => toast.success("Deleted"),
          onError: () => toast.error("Could not delete"),
        },
      );
    })();
  };

  const save = (): void => {
    const clean = draft.trim();
    if (!clean || clean === term.name) {
      setEditing(false);
      return;
    }
    update.mutate(
      { kind: term.kind, slug: term.slug, name: clean },
      {
        onSuccess: () => {
          setEditing(false);
          toast.success("Renamed");
        },
        onError: () => toast.error("Could not rename"),
      },
    );
  };

  return (
    <li className="flex items-center gap-2 px-4 py-2.5">
      {editing ? (
        <>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            autoFocus
            className="h-8"
          />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={save}>
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => {
              setDraft(term.name);
              setEditing(false);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm">{term.name}</span>
          <span className="text-xs text-muted-foreground">{term.count} posts</span>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => {
              setDraft(term.name);
              setEditing(true);
            }}
            title="Rename"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive"
            title={DELETE_CONFIRM_LABEL}
            onClick={doDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </li>
  );
};
