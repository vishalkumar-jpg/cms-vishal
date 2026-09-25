import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import {
  useUpdatePageSlug,
  useSetPageParent,
} from "../hooks/usePages";
import { isReservedRootSlug } from "@ob-cms/shared";
import { PAGE_SLUG_REGEX, slugifyPageTitle } from "../lib/pageValidation";
import { eligibleParents, pagePath } from "../pageTree";
import type { PageSummary } from "../types";

const SLUG_RE = PAGE_SLUG_REGEX;
const slugify = slugifyPageTitle;

/**
 * Edit a page's slug (with live URL preview + lowercase/hyphen validation) and
 * its parent (hierarchy). Warns that changing a PUBLISHED slug should be paired
 * with a redirect (the Redirects screen exists for this).
 */
export const EditSlugDialog: React.FC<{
  siteId: string | null;
  page: PageSummary | null;
  pages: PageSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ siteId, page, pages, open, onOpenChange }) => {
  const updateSlug = useUpdatePageSlug(siteId);
  const setParent = useSetPageParent(siteId);
  const [slug, setSlug] = React.useState("");
  const [parentId, setParentId] = React.useState<string>("");

  React.useEffect(() => {
    if (page) {
      setSlug(page.slug);
      setParentId(page.parentId ?? "");
    }
  }, [page]);

  if (!page) return null;

  const formatValid = SLUG_RE.test(slug);
  const reserved = isReservedRootSlug(slug);
  const valid = formatValid && !reserved;
  const isPublished = page.status === "published";
  const slugChanged = slug !== page.slug;
  const parentChanged = (parentId || null) !== (page.parentId ?? null);

  // Live URL preview using the prospective slug + parent.
  const previewPath = pagePath(
    { ...page, slug, parentId: parentId || null },
    pages.map((p) => (p.id === page.id ? { ...p, slug, parentId: parentId || null } : p)),
  );

  const parents = eligibleParents(pages, page.id);

  const onSave = async (): Promise<void> => {
    if (!valid) return;
    try {
      if (parentChanged) {
        await setParent.mutateAsync({ pageId: page.id, parentId: parentId || null });
      }
      if (slugChanged) {
        await updateSlug.mutateAsync({ pageId: page.id, slug });
      }
      toast.success("Page route updated");
      onOpenChange(false);
    } catch {
      toast.error("Could not update route (the slug may be taken).");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Route &amp; hierarchy</DialogTitle>
          <DialogDescription>
            Edit the slug and parent page. The public URL updates live below.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-slug">Slug</Label>
            <Input
              id="edit-slug"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              placeholder="about-us"
            />
            {!valid && slug.length > 0 && (
              <span className="text-xs text-destructive">
                {reserved
                  ? "This slug is reserved for system routes."
                  : "Lowercase letters, numbers, and hyphens only."}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Parent page</Label>
            <Select
              value={parentId || "__none"}
              onValueChange={(v) => setParentId(v === "__none" ? "" : v)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="None (top level)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">None (top level)</SelectItem>
                {parents.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Public URL: </span>
            <span className="font-medium">{previewPath}</span>
          </div>

          {isPublished && slugChanged && (
            <div className="flex items-start gap-2 rounded-md border border-emerald-300/50 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                This page is published. A 301 redirect from <code>/{page.slug}</code> to the
                new URL is created automatically so existing links keep working.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void onSave()}
            disabled={!valid || (!slugChanged && !parentChanged) || updateSlug.isPending}
          >
            Save route
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
