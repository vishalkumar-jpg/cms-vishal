import * as React from "react";
import { useNavigate } from "react-router";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  FileText,
  Home,
  Link2,
  ExternalLink,
  CornerDownRight,
  Send,
  UserCheck,
  CheckCircle2,
  Ban,
  Languages,
  Loader2,
} from "lucide-react";
import { Button, Input } from "@/components/ui";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { useConfirm } from "@/components/ui/confirm-provider";
import {
  DELETE_CONFIRM_LABEL,
  DELETE_PAGE_CONFIRM_DESCRIPTION,
  PUBLISH_CONFIRM_DESCRIPTION,
  PUBLISH_CONFIRM_LABEL,
} from "@/components/ui/confirm-labels";
import { useSiteStore } from "@/store/siteStore";
import { useAppSelector } from "@/store/store";
import { useActiveSite } from "@/views/sites/hooks/useSites";
import { useLocales } from "@/views/settings/hooks/useSettings";
import { useCanReview } from "@/hooks/useActiveRole";
import { useMembers } from "@/views/members/hooks/useMembers";
import {
  SubmitReviewDialog,
  RejectDialog,
  WorkflowBadge,
  WORKFLOW_LABELS,
  type ReviewerOption,
} from "@/components/workflow/workflow";
import {
  usePages,
  useDeletePage,
  useDuplicatePage,
  useSetHomePage,
  usePublishPage,
  useSubmitPageReview,
  useApprovePage,
  useRejectPage,
  useCreatePageTranslation,
} from "./hooks/usePages";
import { CreatePageDialog } from "./components/CreatePageDialog";
import { EditSlugDialog } from "./components/EditSlugDialog";
import { prefetchBuilderBundle } from "@/views/builder/craft/layoutPrep";
import { buildPageTree, pagePath, isHomePage, HOME_SLUG } from "./pageTree";
import { sitePageUrl } from "@/views/builder/lib/siteUrl";
import {
  WORKFLOW_STATES,
  type ListPagesQuery,
  type PageStatus,
  type PageSummary,
  type WorkflowState,
} from "./types";
import type { Site } from "@ob-cms/shared";

const STATUS_VARIANT: Record<PageStatus, BadgeProps["variant"]> = {
  draft: "muted",
  published: "success",
  scheduled: "warning",
  archived: "outline",
};

const ALL = "all";

export const Pages: React.FC = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const { activeSite } = useActiveSite();
  const { data: siteLocales } = useLocales();
  const activeLocale = useAppSelector((s) => s.locale.locale);
  const defaultLocale = siteLocales?.defaultLocale ?? "en";
  // i18n (B13): "translation mode" — a non-default locale is selected. The list
  // then shows that locale's pages (existing translations) and offers
  // "Add translation" on default-locale pages missing one in this locale.
  const isMultiLocale = (siteLocales?.locales.length ?? 1) > 1;
  const translationMode =
    isMultiLocale && !!activeLocale && activeLocale !== defaultLocale;
  const navigate = useNavigate();
  const [search, setSearch] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [routePage, setRoutePage] = React.useState<PageSummary | null>(null);
  const [workflow, setWorkflow] = React.useState<WorkflowState | typeof ALL>(ALL);
  const [queueMine, setQueueMine] = React.useState(false);
  const [submitFor, setSubmitFor] = React.useState<PageSummary | null>(null);
  const [rejectFor, setRejectFor] = React.useState<PageSummary | null>(null);

  // A workflow/queue filter narrows the list server-side and flattens the tree.
  const workflowFilterActive = workflow !== ALL || queueMine;
  const query: ListPagesQuery | undefined = React.useMemo(() => {
    if (!workflowFilterActive) return undefined;
    const q: ListPagesQuery = {};
    if (workflow !== ALL) q.state = workflow;
    if (queueMine) q.assignedTo = "me";
    return q;
  }, [workflow, queueMine, workflowFilterActive]);

  // In translation mode we always list the default-locale canonical set (so the
  // user can add missing translations); otherwise we honor the workflow query.
  const baseQuery: ListPagesQuery | undefined = translationMode
    ? { locale: defaultLocale }
    : query;
  const { data: pages = [], isLoading, isError, refetch } = usePages(siteId, baseQuery);
  // The existing translations in the active locale (to know which already exist).
  // When not in translation mode we reuse the SAME query as the main list so
  // react-query dedupes it to a single request (no extra fetch single-locale).
  const { data: localePages = [] } = usePages(
    siteId,
    translationMode ? { locale: activeLocale } : baseQuery,
  );
  // translationKey → the translation row for the active locale.
  const localeByKey = React.useMemo(() => {
    const m = new Map<string, PageSummary>();
    for (const p of localePages) {
      const key = p.translationKey ?? p.id;
      m.set(key, p);
    }
    return m;
  }, [localePages]);
  const createTranslation = useCreatePageTranslation(siteId);
  const del = useDeletePage(siteId);
  const dup = useDuplicatePage(siteId);
  const setHome = useSetHomePage(siteId);
  const publish = usePublishPage(siteId);
  const submitReview = useSubmitPageReview(siteId);
  const approve = useApprovePage(siteId);
  const reject = useRejectPage(siteId);

  const confirm = useConfirm();
  const canReview = useCanReview();
  const { data: members = [] } = useMembers();
  const reviewers: ReviewerOption[] = React.useMemo(
    () =>
      members
        .filter((m) => m.role !== "contributor")
        .map((m) => ({ userId: m.userId, label: m.user?.email ?? m.userId })),
    [members],
  );

  const currentHome = React.useMemo(() => pages.find(isHomePage) ?? null, [pages]);

  // When searching or filtering by workflow, show a flat list; otherwise the tree.
  const searching = search.trim().length > 0;
  const flat = searching || workflowFilterActive;
  const filtered = React.useMemo(
    () =>
      pages.filter(
        (p) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.slug.toLowerCase().includes(search.toLowerCase()),
      ),
    [pages, search],
  );
  const tree = React.useMemo(() => buildPageTree(pages).flat, [pages]);

  const rows = flat
    ? filtered.map((page) => ({ page, depth: 0 }))
    : tree.map((n) => ({ page: n.page, depth: n.depth }));

  const openBuilder = (pageId: string): void => {
    prefetchBuilderBundle();
    void navigate(`/pages/${pageId}/builder`);
  };

  // i18n (B13): create a translation of a default-locale page in the active
  // locale, then open the new draft in the builder.
  const onAddTranslation = (page: PageSummary): void => {
    createTranslation.mutate(
      { pageId: page.id, payload: { locale: activeLocale } },
      {
        onSuccess: (created) => {
          toast.success(`Created ${activeLocale.toUpperCase()} translation`);
          openBuilder(created.id);
        },
        onError: () => toast.error("Could not create translation"),
      },
    );
  };

  const doSubmit = (reviewerId?: string): void => {
    if (!submitFor) return;
    submitReview.mutate(
      { pageId: submitFor.id, reviewerId },
      {
        onSuccess: () => {
          toast.success("Submitted for review");
          setSubmitFor(null);
        },
        onError: () => toast.error("Could not submit for review"),
      },
    );
  };

  const doReject = (note: string): void => {
    if (!rejectFor) return;
    reject.mutate(
      { pageId: rejectFor.id, note },
      {
        onSuccess: () => {
          toast.success("Sent back to draft");
          setRejectFor(null);
        },
        onError: () => toast.error("Could not reject"),
      },
    );
  };

  const doApprove = (page: PageSummary): void =>
    approve.mutate(
      { pageId: page.id },
      { onSuccess: () => toast.success("Approved"), onError: () => toast.error("Approve failed") },
    );

  const doPublish = (page: PageSummary): void => {
    void (async () => {
      const ok = await confirm({
        title: `Publish "${page.title}"?`,
        description: PUBLISH_CONFIRM_DESCRIPTION,
        confirmLabel: PUBLISH_CONFIRM_LABEL,
      });
      if (!ok) return;
      publish.mutate(page.id, {
        onSuccess: () => toast.success("Page published"),
        onError: () => toast.error("Publish failed"),
      });
    })();
  };

  const doDelete = (page: PageSummary): void => {
    void (async () => {
      const ok = await confirm({
        title: `Delete "${page.title}"?`,
        description: DELETE_PAGE_CONFIRM_DESCRIPTION,
        confirmLabel: DELETE_CONFIRM_LABEL,
        destructive: true,
      });
      if (!ok) return;
      del.mutate(page.id, {
        onSuccess: () => toast.success("Page deleted"),
        onError: () => toast.error("Delete failed"),
      });
    })();
  };

  const onSetHome = (page: PageSummary): void => {
    void (async () => {
      const ok = await confirm({
        title: `Set "${page.title}" as home page?`,
        description: "Visitors landing on your site's root URL will see this page.",
        confirmLabel: "Set as home",
      });
      if (!ok) return;
      setHome.mutate(
        { pageId: page.id, currentHome },
        {
          onSuccess: () => toast.success(`"${page.title}" is now the home page`),
          onError: () => toast.error("Could not set home page"),
        },
      );
     })();
   };

   return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pages</h1>
          <p className="text-sm text-muted-foreground">
            Manage the page tree, routes, and home page for{" "}
            <span className="font-medium">{activeSite?.name ?? "this site"}</span>.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={!siteId}>
          <Plus className="mr-1.5 h-4 w-4" /> New page
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pages…"
            className="pl-9"
          />
        </div>
        <Select
          value={workflow}
          onValueChange={(v) => setWorkflow(v as WorkflowState | typeof ALL)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Workflow" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All states</SelectItem>
            {WORKFLOW_STATES.map((s) => (
              <SelectItem key={s} value={s}>
                {WORKFLOW_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          variant={queueMine ? "default" : "outline"}
          onClick={() => setQueueMine((v) => !v)}
          title="Show only pages assigned to me for review"
        >
          <UserCheck className="mr-1.5 h-3.5 w-3.5" /> Review queue
        </Button>
      </div>

      {translationMode && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <Languages className="h-3.5 w-3.5 text-primary" />
          Showing your <strong className="uppercase">{defaultLocale}</strong> pages. Use the row
          menu to add or open the{" "}
          <strong className="uppercase">{activeLocale}</strong> translation.
        </div>
      )}

      <div className="-mx-4 overflow-x-auto rounded-lg border border-border px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Route</th>
              <th className="px-4 py-3 font-medium">Workflow</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!siteId && <EmptyRow text="Select a website to view its pages." />}
            {siteId && isLoading && (
              <EmptyRow text="Loading pages…" icon={<Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin opacity-40" />} />
            )}
            {siteId && isError && (
              <EmptyRow
                text="Could not load pages. Check your connection and try again."
                action={
                  <Button variant="outline" size="sm" onClick={() => void refetch()}>
                    Retry
                  </Button>
                }
              />
            )}
            {siteId && !isLoading && !isError && rows.length === 0 && (
              <EmptyRow
                text={searching ? "No pages match your search." : workflowFilterActive ? "No pages match the selected filters." : "No pages yet."}
                action={
                  searching || workflowFilterActive ? (
                    <Button variant="outline" size="sm" onClick={() => { setSearch(""); setWorkflow(ALL); setQueueMine(false); }}>
                      Clear filters
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setCreateOpen(true)}>
                      <Plus className="mr-1.5 h-4 w-4" /> Create first page
                    </Button>
                  )
                }
              />
            )}
            {rows.map(({ page, depth }) => {
              const key = page.translationKey ?? page.id;
              const translation = translationMode ? localeByKey.get(key) : undefined;
              return (
              <PageRow
                key={page.id}
                page={page}
                depth={depth}
                path={pagePath(page, pages)}
                isHome={isHomePage(page)}
                 activeSite={activeSite}
                canReview={canReview}
                rowLocale={page.locale ?? defaultLocale}
                showLocale={isMultiLocale}
                translationMode={translationMode}
                activeLocale={activeLocale}
                hasTranslation={!!translation}
                onAddTranslation={() => onAddTranslation(page)}
                onOpenTranslation={() => translation && openBuilder(translation.id)}
                onOpen={() => openBuilder(page.id)}
                onEditRoute={() => setRoutePage(page)}
                onSetHome={() => onSetHome(page)}
                onSubmitReview={() => setSubmitFor(page)}
                onApprove={() => doApprove(page)}
                onReject={() => setRejectFor(page)}
                onPublish={() => doPublish(page)}
                onDuplicate={() => {
                  dup.mutate(page.id, {
                    onSuccess: () => toast.success("Page duplicated"),
                    onError: () => toast.error("Duplicate failed"),
                  });
                }}
                onDelete={() => doDelete(page)}
              />
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        The page with slug <code>{HOME_SLUG}</code> is served at <code>/</code> (your home page).
        Indent reflects the parent / child hierarchy.
      </p>

      <CreatePageDialog
        siteId={siteId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(pageId) => openBuilder(pageId)}
      />
      <EditSlugDialog
        siteId={siteId}
        page={routePage}
        pages={pages}
        open={!!routePage}
        onOpenChange={(o) => !o && setRoutePage(null)}
      />

      <SubmitReviewDialog
        open={!!submitFor}
        title={submitFor?.title}
        reviewers={reviewers}
        pending={submitReview.isPending}
        onOpenChange={(o) => !o && setSubmitFor(null)}
        onSubmit={doSubmit}
      />
      <RejectDialog
        open={!!rejectFor}
        title={rejectFor?.title}
        pending={reject.isPending}
        onOpenChange={(o) => !o && setRejectFor(null)}
        onReject={doReject}
      />
    </div>
  );
};

const EmptyRow: React.FC<{ text: string; icon?: React.ReactNode; action?: React.ReactNode }> = ({
  text,
  icon,
  action,
}) => (
  <tr>
    <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
      {icon ?? <FileText className="mx-auto mb-2 h-6 w-6 opacity-40" />}
      <p className="mb-3">{text}</p>
      {action}
    </td>
  </tr>
);

const PageRow: React.FC<{
  page: PageSummary;
  depth: number;
  path: string;
  isHome: boolean;
  activeSite: Site | null;
  canReview: boolean;
  rowLocale: string;
  showLocale: boolean;
  translationMode: boolean;
  activeLocale: string;
  hasTranslation: boolean;
  onAddTranslation: () => void;
  onOpenTranslation: () => void;
  onOpen: () => void;
  onEditRoute: () => void;
  onSetHome: () => void;
  onSubmitReview: () => void;
  onApprove: () => void;
  onReject: () => void;
  onPublish: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}> = ({
  page,
  depth,
  path,
  isHome,
  activeSite,
  canReview,
  rowLocale,
  showLocale,
  translationMode,
  activeLocale,
  hasTranslation,
  onAddTranslation,
  onOpenTranslation,
  onOpen,
  onEditRoute,
  onSetHome,
  onSubmitReview,
  onApprove,
  onReject,
  onPublish,
  onDuplicate,
  onDelete,
}) => {
  const publicUrl = sitePageUrl(activeSite, page.slug);
  const state: WorkflowState =
    page.workflowState ?? (page.status === "published" ? "published" : "draft");
  return (
    <tr className="hover:bg-muted/30" onMouseEnter={prefetchBuilderBundle}>
      <td className="cursor-pointer px-4 py-3 font-medium" onClick={onOpen}>
        <div className="flex items-center gap-1.5" style={{ paddingLeft: depth * 18 }}>
          {depth > 0 && <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground/60" />}
          <span className="truncate">{page.title}</span>
          {isHome && (
            <Badge variant="success" className="ml-1 gap-1">
              <Home className="h-3 w-3" /> Home
            </Badge>
          )}
          {/* i18n (B13): per-row locale badge (only when the site is multi-locale). */}
          {showLocale && (
            <Badge variant="outline" className="ml-1 gap-1 uppercase">
              <Languages className="h-3 w-3" /> {rowLocale}
            </Badge>
          )}
          {translationMode && (
            <Badge
              variant={hasTranslation ? "success" : "muted"}
              className="ml-0.5 uppercase"
              title={
                hasTranslation
                  ? `${activeLocale} translation exists`
                  : `No ${activeLocale} translation yet`
              }
            >
              {activeLocale}
              {hasTranslation ? " ✓" : " —"}
            </Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs">{path}</span>
          {publicUrl && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground/60 hover:text-foreground"
              title={publicUrl}
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <WorkflowBadge state={state} />
            <Badge variant={STATUS_VARIANT[page.status]}>{page.status}</Badge>
            {page.expiresAt && (
              <Badge variant="warning" title={new Date(page.expiresAt).toLocaleString()}>
                Expires {new Date(page.expiresAt).toLocaleDateString()}
              </Badge>
            )}
          </div>
          {state === "in_review" && page.reviewerId && (
            <span className="text-xs text-muted-foreground">Assigned</span>
          )}
          {page.reviewNote && state === "draft" && (
            <span className="text-xs text-destructive" title={page.reviewNote}>
              Rejected: {page.reviewNote}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onOpen}>
              <Pencil className="h-4 w-4" /> Open in builder
            </DropdownMenuItem>
            {translationMode &&
              (hasTranslation ? (
                <DropdownMenuItem onClick={onOpenTranslation}>
                  <Languages className="h-4 w-4" /> Open {activeLocale.toUpperCase()} translation
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onAddTranslation}>
                  <Languages className="h-4 w-4" /> Add {activeLocale.toUpperCase()} translation
                </DropdownMenuItem>
              ))}
            <DropdownMenuItem onClick={onEditRoute}>
              <Link2 className="h-4 w-4" /> Route &amp; hierarchy
            </DropdownMenuItem>
            {!isHome && (
              <DropdownMenuItem onClick={onSetHome}>
                <Home className="h-4 w-4" /> Set as home page
              </DropdownMenuItem>
            )}
            {state === "draft" && (
              <DropdownMenuItem onClick={onSubmitReview}>
                <UserCheck className="h-4 w-4" /> Submit for review
              </DropdownMenuItem>
            )}
            {canReview && state === "in_review" && (
              <>
                <DropdownMenuItem onClick={onApprove}>
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onReject} className="text-destructive">
                  <Ban className="h-4 w-4" /> Reject
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={onPublish} disabled={state === "in_review"}>
              <Send className="h-4 w-4" /> Publish
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-4 w-4" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
};
