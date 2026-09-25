import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { useCreatePageFromTemplate, usePages } from "@/views/pages/hooks/usePages";
import { pageSeoMetaSchema, pageTitleSlugSchema, slugifyPageTitle } from "@/views/pages/lib/pageValidation";
import { buildCreateFromTemplatePayload } from "../lib/buildCreateFromTemplatePayload";
import { USE_STARTER_TEMPLATE_LABEL } from "../lib/catalogLabels";
import { getApiErrorMessage } from "../lib/getApiErrorMessage";
import type { TemplateCatalogEntry } from "../types";

/** Exported for unit tests — matches API CreatePageFromTemplateDto rules. */
export const useTemplateDialogSchema = pageTitleSlugSchema;
type FormValues = {
  title: string;
  slug: string;
};

export type UseTemplateDialogProps = {
  siteId: string | null;
  template: TemplateCatalogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (pageId: string) => void;
};

/**
 * Create a draft page from a published catalog template, then open the builder.
 * Mirrors CreatePageDialog (RHF + zod) with Collections-style slug lock after manual edit.
 */
export const UseTemplateDialog: React.FC<UseTemplateDialogProps> = ({
  siteId,
  template,
  open,
  onOpenChange,
  onCreated,
}) => {
  const create = useCreatePageFromTemplate(siteId);
  const { data: pages = [] } = usePages(open ? siteId : null);
  const [slugDirty, setSlugDirty] = React.useState(false);
  const [parentId, setParentId] = React.useState("");
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [seoTitle, setSeoTitle] = React.useState("");
  const [seoDescription, setSeoDescription] = React.useState("");
  const [seoError, setSeoError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(useTemplateDialogSchema),
    defaultValues: { title: "", slug: "" },
  });

  const title = watch("title");
  const slugField = register("slug");

  const resetOptionalFields = (): void => {
    setParentId("");
    setShowAdvanced(false);
    setSeoTitle("");
    setSeoDescription("");
    setSeoError(null);
  };

  React.useEffect(() => {
    if (!open || !template) return;
    const nextTitle = template.displayName;
    reset({ title: nextTitle, slug: slugifyPageTitle(nextTitle) });
    setSlugDirty(false);
    resetOptionalFields();
  }, [open, template, reset]);

  React.useEffect(() => {
    if (!slugDirty) setValue("slug", slugifyPageTitle(title));
  }, [title, slugDirty, setValue]);

  const onSubmit = async (values: FormValues): Promise<void> => {
    if (!template || create.isPending) return;

    const seoResult = pageSeoMetaSchema.safeParse({
      title: seoTitle || undefined,
      description: seoDescription || undefined,
    });
    if (!seoResult.success) {
      setSeoError(seoResult.error.errors[0]?.message ?? "Invalid SEO fields");
      return;
    }
    setSeoError(null);

    try {
      const page = await create.mutateAsync(
        buildCreateFromTemplatePayload({
          title: values.title,
          slug: values.slug,
          skeletonId: template.id,
          parentId: parentId || undefined,
          seoTitle,
          seoDescription,
        }),
      );
      toast.success("Page created");
      reset();
      setSlugDirty(false);
      resetOptionalFields();
      onOpenChange(false);
      onCreated?.(page.id);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not create page from template"));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && create.isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{USE_STARTER_TEMPLATE_LABEL}</DialogTitle>
          <DialogDescription>
            {template
              ? `Create a draft page from “${template.displayName}”, then open it in the builder.`
              : "Create a draft page from this starter, then open it in the builder."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" aria-busy={create.isPending}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="use-template-title">Title</Label>
            <Input
              id="use-template-title"
              {...register("title")}
              autoFocus
              placeholder="Home"
              disabled={create.isPending}
              aria-invalid={Boolean(errors.title)}
              maxLength={300}
            />
            {errors.title ? (
              <span className="text-xs text-destructive" role="alert">
                {errors.title.message}
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="use-template-slug">Slug</Label>
            <Input
              id="use-template-slug"
              {...slugField}
              placeholder="home"
              disabled={create.isPending}
              aria-invalid={Boolean(errors.slug)}
              maxLength={200}
              onChange={(e) => {
                setSlugDirty(true);
                slugField.onChange(e);
              }}
            />
            {errors.slug ? (
              <span className="text-xs text-destructive" role="alert">
                {errors.slug.message}
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="use-template-parent">Parent page</Label>
            <Select
              value={parentId || "__none"}
              onValueChange={(v) => setParentId(v === "__none" ? "" : v)}
              disabled={create.isPending}
            >
              <SelectTrigger id="use-template-parent" className="h-9">
                <SelectValue placeholder="None (top level)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">None (top level)</SelectItem>
                {pages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-9 justify-start px-0 text-sm font-medium"
              aria-expanded={showAdvanced}
              onClick={() => setShowAdvanced((prev) => !prev)}
              disabled={create.isPending}
            >
              <ChevronDown
                className={`mr-1 h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                aria-hidden
              />
              Advanced options
            </Button>
            {showAdvanced ? (
              <div className="flex flex-col gap-3 rounded-md border border-border p-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="use-template-seo-title">Meta title</Label>
                  <Input
                    id="use-template-seo-title"
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    disabled={create.isPending}
                    maxLength={300}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="use-template-seo-description">Meta description</Label>
                  <Textarea
                    id="use-template-seo-description"
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                    disabled={create.isPending}
                    maxLength={500}
                    rows={3}
                  />
                </div>
                {seoError ? (
                  <span className="text-xs text-destructive" role="alert">
                    {seoError}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={create.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!template || !siteId || create.isPending}>
              {create.isPending ? "Creating…" : "Create page"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
