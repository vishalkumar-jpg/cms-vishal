import * as React from "react";
import { ImagePlus, X, Plus, CalendarClock } from "lucide-react";
import { Button, Input, Label, Switch } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { ImageField } from "@/views/builder/property/ContentControls";
import { useMediaPicker } from "@/views/media/components/MediaPickerProvider";
import {
  usePost,
  useUpdatePost,
  useSchedulePost,
  useTerms,
} from "../hooks/useBlog";
import type { PostSeo, PostTerm } from "../types";

const slugify = (s: string): string =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** ISO → value for <input type="datetime-local"> (local-time, minute precision). */
const toLocalInput = (iso?: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

/**
 * Post meta + SEO + taxonomy + scheduling. Replaces the old raw-JSON post editor
 * for everything EXCEPT the content body (which lives in the visual builder).
 * PATCH /posts/:id with { title, slug, excerpt, coverMediaId, seo, terms }.
 */
export const PostSettingsDialog: React.FC<{
  postId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ postId, open, onOpenChange }) => {
  const { data: post } = usePost(open ? postId : null);
  const update = useUpdatePost();
  const schedule = useSchedulePost();
  const openMediaPicker = useMediaPicker();
  const { data: categories = [] } = useTerms("category");
  const { data: tags = [] } = useTerms("tag");

  const [title, setTitle] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [excerpt, setExcerpt] = React.useState("");
  const [coverMediaId, setCoverMediaId] = React.useState<string | null>(null);
  const [coverUrl, setCoverUrl] = React.useState<string | null>(null);
  const [seo, setSeo] = React.useState<PostSeo>({});
  const [cats, setCats] = React.useState<string[]>([]);
  const [tagNames, setTagNames] = React.useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = React.useState("");
  // CONTENT-OPS — expiry (auto-unpublish) datetime.
  const [expiresAt, setExpiresAt] = React.useState("");

  React.useEffect(() => {
    if (!open || !post) return;
    setTitle(post.title);
    setSlug(post.slug);
    setExcerpt(post.excerpt ?? "");
    setCoverMediaId(post.coverMediaId);
    setCoverUrl(null);
    setSeo((post.seo as PostSeo) ?? {});
    const terms = (post.terms ?? []) as PostTerm[];
    setCats(terms.filter((t) => t.kind === "category").map((t) => t.name));
    setTagNames(terms.filter((t) => t.kind === "tag").map((t) => t.name));
    setScheduledAt("");
    setExpiresAt(toLocalInput(post.expiresAt ?? null));
  }, [open, post]);

  const setSeoField = (key: keyof PostSeo, value: unknown): void =>
    setSeo((prev) => ({ ...prev, [key]: value }));

  const pickCover = async (): Promise<void> => {
    const item = await openMediaPicker();
    if (item) {
      setCoverMediaId(item.id);
      setCoverUrl(item.url);
    }
  };

  const onSave = (): void => {
    if (!postId) return;
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    const terms: PostTerm[] = [
      ...cats.map((name) => ({ kind: "category" as const, name })),
      ...tagNames.map((name) => ({ kind: "tag" as const, name })),
    ];
    update.mutate(
      {
        id: postId,
        payload: {
          title: title.trim(),
          slug: slug.trim().toLowerCase(),
          excerpt: excerpt.trim() || undefined,
          coverMediaId: coverMediaId ?? undefined,
          seo,
          terms,
          // CONTENT-OPS — persist expiry (set or clear) with the settings save.
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Post settings saved");
          onOpenChange(false);
        },
        onError: () => toast.error("Could not save settings"),
      },
    );
  };

  const onSchedule = (): void => {
    if (!postId || !scheduledAt) return;
    schedule.mutate(
      { id: postId, scheduledAt: new Date(scheduledAt).toISOString() },
      {
        onSuccess: () => toast.success("Post scheduled"),
        onError: () => toast.error("Could not schedule (must be a future time)"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Post settings</DialogTitle>
          <DialogDescription>Metadata, cover, SEO, taxonomy and scheduling.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Slug">
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="my-post" />
          </Field>
          <Field label="Excerpt">
            <Textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={2}
              placeholder="Short summary shown in listings…"
            />
          </Field>

          <Field label="Cover image">
            {coverMediaId ? (
              <div className="flex items-center gap-3">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt="Cover"
                    className="h-16 w-24 rounded-md border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-24 items-center justify-center rounded-md border border-border bg-muted text-xs text-muted-foreground">
                    selected
                  </div>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => void pickCover()}>
                  Replace
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => {
                    setCoverMediaId(null);
                    setCoverUrl(null);
                  }}
                >
                  <X className="mr-1 h-4 w-4" /> Remove
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => void pickCover()}
              >
                <ImagePlus className="mr-1.5 h-4 w-4" /> Choose cover
              </Button>
            )}
          </Field>

          <TermField
            label="Categories"
            values={cats}
            onChange={setCats}
            suggestions={categories.map((t) => t.name)}
          />
          <TermField
            label="Tags"
            values={tagNames}
            onChange={setTagNames}
            suggestions={tags.map((t) => t.name)}
          />

          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            SEO
          </p>
          <Field label="Meta title">
            <Input value={seo.title ?? ""} onChange={(e) => setSeoField("title", e.target.value)} />
          </Field>
          <Field label="Meta description">
            <Textarea
              value={seo.description ?? ""}
              onChange={(e) => setSeoField("description", e.target.value)}
            />
          </Field>
          <Field label="Canonical URL">
            <Input
              value={seo.canonical ?? ""}
              onChange={(e) => setSeoField("canonical", e.target.value)}
            />
          </Field>
          <ImageField
            label="OG image"
            value={seo.ogImage ?? ""}
            onChange={(v) => setSeoField("ogImage", v)}
          />
          <div className="flex items-center justify-between">
            <Label>No-index (hide from search)</Label>
            <Switch checked={!!seo.noindex} onCheckedChange={(c) => setSeoField("noindex", c)} />
          </div>

          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Schedule
          </p>
          <div className="flex items-end gap-2">
            <Field label="Publish at" className="flex-1">
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </Field>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!scheduledAt || schedule.isPending}
              onClick={onSchedule}
            >
              <CalendarClock className="mr-1.5 h-4 w-4" /> Schedule
            </Button>
          </div>
          {/* CONTENT-OPS — expiry (auto-unpublish). Saved with "Save settings". */}
          <Field label="Expires (auto-unpublish)">
            <Input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            <span className="text-[11px] text-muted-foreground">
              When set, the post is automatically unpublished after this time. Cleared on the
              next manual publish.
            </span>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={update.isPending}>
            Save settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Field: React.FC<{ label: string; className?: string; children: React.ReactNode }> = ({
  label,
  className,
  children,
}) => (
  <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
    <Label>{label}</Label>
    {children}
  </div>
);

/** Chip-style multi-select with free-text add + suggestions from existing terms. */
const TermField: React.FC<{
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  suggestions: string[];
}> = ({ label, values, onChange, suggestions }) => {
  const [draft, setDraft] = React.useState("");

  const add = (name: string): void => {
    const clean = name.trim();
    if (!clean) return;
    if (values.some((v) => slugify(v) === slugify(clean))) return;
    onChange([...values, clean]);
    setDraft("");
  };

  const remove = (name: string): void => onChange(values.filter((v) => v !== name));

  const unused = suggestions.filter(
    (s) => !values.some((v) => slugify(v) === slugify(s)),
  );

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1">
              {v}
              <button type="button" onClick={() => remove(v)} aria-label={`Remove ${v}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder={`Add a ${label.toLowerCase().replace(/s$/, "")}…`}
        />
        <Button type="button" variant="outline" size="icon" onClick={() => add(draft)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unused.slice(0, 12).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
