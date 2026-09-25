import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, Label } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { useCreatePage } from "../hooks/usePages";
import { pageTitleSlugSchema, slugifyPageTitle } from "../lib/pageValidation";

const schema = pageTitleSlugSchema;
type FormValues = {
  title: string;
  slug: string;
};

export const CreatePageDialog: React.FC<{
  siteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (pageId: string) => void;
}> = ({ siteId, open, onOpenChange, onCreated }) => {
  const create = useCreatePage(siteId);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { title: "", slug: "" } });

  const title = watch("title");
  React.useEffect(() => {
    setValue("slug", slugifyPageTitle(title));
  }, [title, setValue]);

  const onSubmit = async (values: FormValues): Promise<void> => {
    if (create.isPending) return;
    try {
      const page = await create.mutateAsync(values);
      toast.success("Page created");
      reset();
      onOpenChange(false);
      onCreated?.(page.id);
    } catch {
      toast.error("Could not create page");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New page</DialogTitle>
          <DialogDescription>Create a draft page, then open it in the builder.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" aria-busy={create.isPending}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="page-title">Title</Label>
            <Input
              id="page-title"
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
            <Label htmlFor="page-slug">Slug</Label>
            <Input
              id="page-slug"
              {...register("slug")}
              placeholder="home"
              disabled={create.isPending}
              aria-invalid={Boolean(errors.slug)}
              maxLength={200}
            />
            {errors.slug ? (
              <span className="text-xs text-destructive" role="alert">
                {errors.slug.message}
              </span>
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
            <Button type="submit" disabled={!siteId || create.isPending}>
              {create.isPending ? "Creating…" : "Create page"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
