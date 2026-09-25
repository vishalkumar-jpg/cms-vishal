import * as React from "react";
import { useNavigate } from "react-router";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
  Newspaper,
  Settings2,
  RotateCcw,
  XCircle,
  CheckCircle2,
  Ban,
  UserCheck,
  Languages,
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
  DELETE_CANNOT_UNDO_DESCRIPTION,
  PUBLISH_CONFIRM_DESCRIPTION,
  PUBLISH_CONFIRM_LABEL,
} from "@/components/ui/confirm-labels";
import {
  BLOG_BULK_PUBLISH_DESCRIPTION,
  BLOG_BULK_TRASH_DESCRIPTION,
  BLOG_PERMANENT_DELETE_CONFIRM_LABEL,
  BLOG_TRASH_CONFIRM_LABEL,
  BLOG_TRASH_SINGLE_DESCRIPTION,
} from "./constants";
import { cn } from "@/lib/cn";
import { useSiteStore } from "@/store/siteStore";
import { useAppSelector } from "@/store/store";
import { useCanReview } from "@/hooks/useActiveRole";
import { useMembers } from "@/views/members/hooks/useMembers";
import { useLocales } from "@/views/settings/hooks/useSettings";
import {
  SubmitReviewDialog,
  RejectDialog,
  WorkflowBadge,
  WORKFLOW_LABELS,
  type ReviewerOption,
} from "@/components/workflow/workflow";
import {
  usePosts,
  useDeletePost,
  usePublishPost,
  useCreatePost,
  useRestorePost,
  useDestroyPost,
  useBulkPosts,
  useTerms,
  useSubmitPostReview,
  useApprovePost,
  useRejectPost,
  useCreatePostTranslation,
} from "./hooks/useBlog";
import { PostSettingsDialog } from "./components/PostSettingsDialog";
import {
  POST_STATUSES,
  WORKFLOW_STATES,
  type PostStatus,
  type WorkflowState,
  type PostSummary,
  type ListPostsQuery,
} from "./types";

const STATUS_VARIANT: Record<PostStatus, BadgeProps["variant"]> = {
  draft: "muted",
  published: "success",
  scheduled: "warning",
  archived: "outline",
};

const ALL = "all";
const slugify = (s: string): string =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

type Tab = "all" | "trash";

export const Blog: React.FC = () => {
  const siteId = useSiteStore((s) => s.activeSiteId);
  const navigate = useNavigate();
  const { data: siteLocales } = useLocales();
  const activeLocale = useAppSelector((s) => s.locale.locale);
  const defaultLocale = siteLocales?.defaultLocale ?? "en";
  const isMultiLocale = (siteLocales?.locales.length ?? 1) > 1;
  // i18n (B13): translation mode — a non-default locale is selected.
  const translationMode =
    isMultiLocale && !!activeLocale && activeLocale !== defaultLocale;

  const [tab, setTab] = React.useState<Tab>("all");
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<PostStatus | typeof ALL>(ALL);
  const [workflow, setWorkflow] = React.useState<WorkflowState | typeof ALL>(ALL);
  const [queueMine, setQueueMine] = React.useState(false);
  const [category, setCategory] = React.useState<string>(ALL);
  const [tag, setTag] = React.useState<string>(ALL);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [settingsId, setSettingsId] = React.useState<string | null>(null);
  // B14 workflow action dialogs (submit / reject) target one post at a time.
  const [submitFor, setSubmitFor] = React.useState<PostSummary | null>(null);
  const [rejectFor, setRejectFor] = React.useState<PostSummary | null>(null);

  const canReview = useCanReview();
  const { data: members = [] } = useMembers();
  const reviewers: ReviewerOption[] = React.useMemo(
    () =>
      members
        .filter((m) => m.role !== "contributor")
        .map((m) => ({
          userId: m.userId,
          label: m.user?.email ?? m.userId,
        })),
    [members],
  );

  const query: ListPostsQuery = React.useMemo(() => {
    if (tab === "trash") return { trashed: true };
    const q: ListPostsQuery = {};
    if (status !== ALL) q.status = status;
    if (workflow !== ALL) q.state = workflow;
    if (queueMine) q.assignedTo = "me";
    if (category !== ALL) q.category = category;
    if (tag !== ALL) q.tag = tag;
    // In translation mode the canonical list is the default locale's posts.
    if (translationMode) q.locale = defaultLocale;
    return q;
  }, [tab, status, workflow, queueMine, category, tag, translationMode, defaultLocale]);

  const { data: posts = [], isLoading, isError } = usePosts(query);
  // i18n: existing translations in the active locale → which already exist.
  // Reuses the main `query` when single-locale so react-query dedupes it.
  const { data: localePosts = [] } = usePosts(
    translationMode ? { locale: activeLocale } : query,
  );
  const localeByKey = React.useMemo(() => {
    const m = new Map<string, PostSummary>();
    for (const p of localePosts) m.set(p.translationKey ?? p.id, p);
    return m;
  }, [localePosts]);
  const createTranslation = useCreatePostTranslation();
  const { data: categories = [] } = useTerms("category");
  const { data: tags = [] } = useTerms("tag");
  const del = useDeletePost();
  const publish = usePublishPost();
  const restore = useRestorePost();
  const destroy = useDestroyPost();
  const bulk = useBulkPosts();
  const create = useCreatePost();
  const submitReview = useSubmitPostReview();
  const approve = useApprovePost();
  const reject = useRejectPost();
  const confirm = useConfirm();

  // Reset selection when switching tab/filters.
  React.useEffect(
    () => setSelected(new Set()),
    [tab, status, workflow, queueMine, category, tag, siteId],
  );

  const filtered = React.useMemo(
    () =>
      posts.filter(
        (p) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.slug.toLowerCase().includes(search.toLowerCase()),
      ),
    [posts, search],
  );

  const allChecked = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const toggleAll = (): void =>
    setSelected(allChecked ? new Set() : new Set(filtered.map((p) => p.id)));
  const toggleOne = (id: string): void =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openCreate = (): void => {
    const title = "Untitled post";
    create.mutate(
      { title, slug: `untitled-${Date.now().toString(36)}` },
      {
        onSuccess: (post) => navigate(`/blog/${post.id}/builder`),
        onError: () => toast.error("Could not create post"),
      },
    );
  };

  const ids = [...selected];
  const runBulk = (op: "publish" | "trash" | "restore"): void => {
    if (op === "restore") {
      bulk.mutate(
        { op, ids },
        {
          onSuccess: (r) => {
            toast.success(`${r.count} post${r.count === 1 ? "" : "s"} updated`);
            setSelected(new Set());
          },
          onError: () => toast.error("Bulk action failed"),
        },
      );
      return;
    }
    void (async () => {
      const count = ids.length;
      const ok = await confirm(
        op === "publish"
          ? {
              title: `Publish ${count} post${count === 1 ? "" : "s"}?`,
              description: BLOG_BULK_PUBLISH_DESCRIPTION,
              confirmLabel: PUBLISH_CONFIRM_LABEL,
            }
          : {
              title: `Move ${count} post${count === 1 ? "" : "s"} to trash?`,
              description: BLOG_BULK_TRASH_DESCRIPTION,
              confirmLabel: BLOG_TRASH_CONFIRM_LABEL,
              destructive: true,
            },
      );
      if (!ok) return;
      bulk.mutate(
        { op, ids },
        {
          onSuccess: (r) => {
            toast.success(`${r.count} post${r.count === 1 ? "" : "s"} updated`);
            setSelected(new Set());
          },
          onError: () => toast.error("Bulk action failed"),
        },
      );
    })();
  };

  const doPublish = (post: PostSummary): void => {
    void (async () => {
      const ok = await confirm({
        title: `Publish "${post.title}"?`,
        description: PUBLISH_CONFIRM_DESCRIPTION,
        confirmLabel: PUBLISH_CONFIRM_LABEL,
      });
      if (!ok) return;
      publish.mutate(post.id, {
        onSuccess: () => toast.success("Post published"),
        onError: () => toast.error("Publish failed"),
      });
    })();
  };

  const doTrash = (post: PostSummary): void => {
    void (async () => {
      const ok = await confirm({
        title: `Move "${post.title}" to trash?`,
        description: BLOG_TRASH_SINGLE_DESCRIPTION,
        confirmLabel: BLOG_TRASH_CONFIRM_LABEL,
        destructive: true,
      });
      if (!ok) return;
      del.mutate(post.id, {
        onSuccess: () => toast.success("Moved to trash"),
        onError: () => toast.error("Delete failed"),
      });
    })();
  };

  const doDestroy = (post: PostSummary): void => {
    void (async () => {
      const ok = await confirm({
        title: `Permanently delete "${post.title}"?`,
        description: DELETE_CANNOT_UNDO_DESCRIPTION,
        confirmLabel: BLOG_PERMANENT_DELETE_CONFIRM_LABEL,
        destructive: true,
      });
      if (!ok) return;
      destroy.mutate(post.id, {
        onSuccess: () => toast.success("Permanently deleted"),
        onError: () => toast.error("Delete failed"),
      });
    })();
  };

  const doSubmit = (reviewerId?: string): void => {
    if (!submitFor) return;
    submitReview.mutate(
      { id: submitFor.id, reviewerId },
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
      { id: rejectFor.id, note },
      {
        onSuccess: () => {
          toast.success("Sent back to draft");
          setRejectFor(null);
        },
        onError: () => toast.error("Could not reject"),
      },
    );
  };

  const doApprove = (post: PostSummary): void =>
    approve.mutate(
      { id: post.id },
      {
        onSuccess: () => toast.success("Approved"),
        onError: () => toast.error("Approve failed"),
      },
    );

  // i18n (B13): create a translation of a default-locale post in the active
  // locale, then open the new draft in the builder.
  const onAddTranslation = (post: PostSummary): void => {
    createTranslation.mutate(
      { id: post.id, payload: { locale: activeLocale } },
      {
        onSuccess: (created) => {
          toast.success(`Created ${activeLocale.toUpperCase()} translation`);
          navigate(`/blog/${created.id}/builder`);
        },
        onError: () => toast.error("Could not create translation"),
      },
    );
  };

  const colSpan = 5;

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Blog</h1>
          <p className="text-sm text-muted-foreground">Write and manage blog posts for this site.</p>
        </div>
        <Button onClick={openCreate} disabled={!siteId || create.isPending}>
          <Plus className="mr-1.5 h-4 w-4" /> New post
        </Button>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-border">
        {(["all", "trash"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "all" ? "All posts" : "Trash"}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search posts…"
            className="pl-9"
          />
        </div>
        {tab === "all" && (
          <>
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
              title="Show only content assigned to me for review"
            >
              <UserCheck className="mr-1.5 h-3.5 w-3.5" /> Review queue
            </Button>
            <Select value={status} onValueChange={(v) => setStatus(v as PostStatus | typeof ALL)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {POST_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {categories.map((t) => (
                  <SelectItem key={t.slug} value={t.slug}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tag} onValueChange={setTag}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All tags</SelectItem>
                {tags.map((t) => (
                  <SelectItem key={t.slug} value={t.slug}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">{selected.size} selected</span>
          <div className="ml-auto flex gap-2">
            {tab === "all" ? (
              <>
                <Button size="sm" variant="outline" disabled={bulk.isPending} onClick={() => runBulk("publish")}>
                  <Send className="mr-1.5 h-3.5 w-3.5" /> Publish
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  disabled={bulk.isPending}
                  onClick={() => runBulk("trash")}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Move to trash
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" disabled={bulk.isPending} onClick={() => runBulk("restore")}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restore
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="-mx-4 overflow-x-auto rounded-lg border border-border px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-3">
                <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" />
              </th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Workflow</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!siteId && <EmptyRow span={colSpan} text="Select a site to view its posts." />}
            {siteId && isLoading && <EmptyRow span={colSpan} text="Loading posts…" />}
            {siteId && isError && <EmptyRow span={colSpan} text="Could not load posts." />}
            {siteId && !isLoading && !isError && filtered.length === 0 && (
              <EmptyRow
                span={colSpan}
                text={tab === "trash" ? "Trash is empty." : "No posts yet. Create your first post."}
              />
            )}
            {filtered.map((post) => {
              const tkey = post.translationKey ?? post.id;
              const translation = translationMode ? localeByKey.get(tkey) : undefined;
              return (
              <PostRow
                key={post.id}
                post={post}
                trash={tab === "trash"}
                canReview={canReview}
                checked={selected.has(post.id)}
                rowLocale={post.locale ?? defaultLocale}
                showLocale={isMultiLocale}
                translationMode={translationMode}
                activeLocale={activeLocale}
                hasTranslation={!!translation}
                onAddTranslation={() => onAddTranslation(post)}
                onOpenTranslation={() => translation && navigate(`/blog/${translation.id}/builder`)}
                onToggle={() => toggleOne(post.id)}
                onEditContent={() => navigate(`/blog/${post.id}/builder`)}
                onSettings={() => setSettingsId(post.id)}
                onSubmitReview={() => setSubmitFor(post)}
                onApprove={() => doApprove(post)}
                onReject={() => setRejectFor(post)}
                onPublish={() => doPublish(post)}
                onTrash={() => doTrash(post)}
                onRestore={() =>
                  restore.mutate(post.id, {
                    onSuccess: () => toast.success("Restored"),
                    onError: () => toast.error("Restore failed"),
                  })
                }
                onDestroy={() => doDestroy(post)}
              />
              );
            })}
          </tbody>
        </table>
      </div>

      <PostSettingsDialog
        postId={settingsId}
        open={!!settingsId}
        onOpenChange={(o) => !o && setSettingsId(null)}
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

/** Minimal styled checkbox (admin has no Checkbox primitive yet). */
const Checkbox: React.FC<{
  checked: boolean;
  onCheckedChange: () => void;
  "aria-label"?: string;
}> = ({ checked, onCheckedChange, ...rest }) => (
  <input
    type="checkbox"
    checked={checked}
    onChange={onCheckedChange}
    onClick={(e) => e.stopPropagation()}
    className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
    {...rest}
  />
);

const EmptyRow: React.FC<{ text: string; span: number }> = ({ text, span }) => (
  <tr>
    <td colSpan={span} className="px-4 py-10 text-center text-sm text-muted-foreground">
      <Newspaper className="mx-auto mb-2 h-6 w-6 opacity-40" />
      {text}
    </td>
  </tr>
);

const PostRow: React.FC<{
  post: PostSummary;
  trash: boolean;
  canReview: boolean;
  checked: boolean;
  rowLocale: string;
  showLocale: boolean;
  translationMode: boolean;
  activeLocale: string;
  hasTranslation: boolean;
  onAddTranslation: () => void;
  onOpenTranslation: () => void;
  onToggle: () => void;
  onEditContent: () => void;
  onSettings: () => void;
  onSubmitReview: () => void;
  onApprove: () => void;
  onReject: () => void;
  onPublish: () => void;
  onTrash: () => void;
  onRestore: () => void;
  onDestroy: () => void;
}> = ({
  post,
  trash,
  canReview,
  checked,
  rowLocale,
  showLocale,
  translationMode,
  activeLocale,
  hasTranslation,
  onAddTranslation,
  onOpenTranslation,
  onToggle,
  onEditContent,
  onSettings,
  onSubmitReview,
  onApprove,
  onReject,
  onPublish,
  onTrash,
  onRestore,
  onDestroy,
}) => {
  // Fall back to the legacy status mapping if the API hasn't sent workflowState.
  const state: WorkflowState =
    post.workflowState ?? (post.status === "published" ? "published" : "draft");
  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3">
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          aria-label={`Select ${post.title}`}
        />
      </td>
      <td
        className="cursor-pointer px-4 py-3 font-medium"
        onClick={trash ? undefined : onEditContent}
      >
        <span className="inline-flex items-center gap-1.5">
          <span>{post.title}</span>
          {/* i18n (B13): per-row locale + translation-status badges. */}
          {showLocale && (
            <Badge variant="outline" className="gap-1 uppercase">
              <Languages className="h-3 w-3" /> {rowLocale}
            </Badge>
          )}
          {translationMode && (
            <Badge
              variant={hasTranslation ? "success" : "muted"}
              className="uppercase"
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
        </span>
      </td>
      <td className="px-4 py-3 text-muted-foreground">/{post.slug}</td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <WorkflowBadge state={state} />
            <Badge variant={STATUS_VARIANT[post.status]}>{post.status}</Badge>
            {post.expiresAt && (
              <Badge variant="warning" title={new Date(post.expiresAt).toLocaleString()}>
                Expires {new Date(post.expiresAt).toLocaleDateString()}
              </Badge>
            )}
          </div>
          {state === "in_review" && post.reviewerId && (
            <span className="text-xs text-muted-foreground">Assigned</span>
          )}
          {post.reviewNote && state === "draft" && (
            <span className="text-xs text-destructive" title={post.reviewNote}>
              Rejected: {post.reviewNote}
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
            {trash ? (
              <>
                <DropdownMenuItem onClick={onRestore}>
                  <RotateCcw className="h-4 w-4" /> Restore
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDestroy} className="text-destructive">
                  <XCircle className="h-4 w-4" /> Delete permanently
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem onClick={onEditContent}>
                  <Pencil className="h-4 w-4" /> Edit content
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
                <DropdownMenuItem onClick={onSettings}>
                  <Settings2 className="h-4 w-4" /> Settings
                </DropdownMenuItem>
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
                <DropdownMenuItem onClick={onTrash} className="text-destructive">
                  <Trash2 className="h-4 w-4" /> Move to trash
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
};
