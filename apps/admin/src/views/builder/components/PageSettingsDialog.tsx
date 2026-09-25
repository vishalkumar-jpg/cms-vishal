import * as React from "react";
import { Button, Input, Label, Switch } from "@/components/ui";
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
import { usePage, usePages, useUpdatePage } from "@/views/pages/hooks/usePages";
import { useActiveSite } from "@/views/sites/hooks/useSites";
import { siteOriginUrl } from "@/views/builder/lib/siteUrl";
import { ImageField } from "../property/ContentControls";
import type { PageSeoMeta, PageLayoutOptions } from "@/views/pages/types";
import { readPageProvenance } from "@/views/pages/lib/pageProvenance";
import { isHomepageSlug, normalizePageLayoutOptions } from "@ob-cms/block-schema";
import { SeoPreviewPanel } from "./seo/SeoPreviewPanel";
import { sampleLayoutSeo } from "./seo/sampleLayout";

/**
 * Page settings + SEO. PATCH /pages/:id with { title, slug, parentId, seo }.
 * Matches UpdatePageDto exactly (slug is lowercased server-side).
 */
export const PageSettingsDialog: React.FC<{
  siteId: string | null;
  pageId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ siteId, pageId, open, onOpenChange }) => {
  const { data: page } = usePage(siteId, open ? pageId : null);
  const { data: pages = [] } = usePages(open ? siteId : null);
  const { activeSite } = useActiveSite();
  const update = useUpdatePage(siteId);

  const [title, setTitle] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [parentId, setParentId] = React.useState<string>("");
  const [seo, setSeo] = React.useState<PageSeoMeta>({});
  const [layoutOptions, setLayoutOptions] = React.useState<PageLayoutOptions>({});

  React.useEffect(() => {
    if (!page) return;
    setTitle(page.title);
    setSlug(page.slug);
    setParentId(page.parentId ?? "");
    setSeo(page.seo ?? {});
    setLayoutOptions(normalizePageLayoutOptions(page.layoutOptions));
  }, [page]);

  const setSeoField = (key: keyof PageSeoMeta, value: unknown): void =>
    setSeo((prev) => ({ ...prev, [key]: value }));

  const setLayoutOption = (key: keyof PageLayoutOptions, value: boolean): void =>
    setLayoutOptions((prev) => ({ ...prev, [key]: value }));

  const isHomepage = page ? isHomepageSlug(page.slug) : false;
  const provenance = readPageProvenance(page);

  // Sample H1/alt signals from the current layout to enrich the SEO score.
  const layoutSignals = React.useMemo(
    () => sampleLayoutSeo(page?.draftLayout ?? page?.publishedLayout ?? null),
    [page?.draftLayout, page?.publishedLayout],
  );
  const baseUrl = siteOriginUrl(activeSite) ?? undefined;

  const onSave = (): void => {
    if (!pageId) return;
    update.mutate(
      {
        pageId,
        payload: {
          title: title.trim(),
          slug: slug.trim().toLowerCase(),
          parentId: parentId || null,
          seo,
          layoutOptions,
        },
      },
      {
        onSuccess: () => {
          toast.success("Page settings saved");
          onOpenChange(false);
        },
        onError: () => toast.error("Could not save settings"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Page settings</DialogTitle>
          <DialogDescription>Metadata, URL and SEO for this page.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Slug">
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="about-us" />
          </Field>
          <Field label="Parent page">
            <Select
              value={parentId || "__none"}
              onValueChange={(v) => setParentId(v === "__none" ? "" : v)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">None (top level)</SelectItem>
                {pages
                  .filter((p) => p.id !== pageId)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>

          {provenance ? (
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Template origin
              </p>
              <p className="mt-1">Created from template</p>
              <p className="font-medium text-foreground">{provenance.sourceTemplateKey}</p>
              <p>Version {provenance.sourceTemplateVersion}</p>
            </div>
          ) : null}

          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Site chrome
          </p>
          <p className="text-xs text-muted-foreground">
            {isHomepage
              ? "This is the homepage — topbar, navbar, and footer defined here are inherited by other pages."
              : "By default this page inherits the topbar, navbar, and footer from the homepage."}
          </p>
          {!isHomepage ? (
            <div className="flex items-center justify-between">
              <Label>Inherit homepage chrome</Label>
              <Switch
                checked={layoutOptions.inheritHomepageChrome !== false}
                onCheckedChange={(c) => setLayoutOption("inheritHomepageChrome", c)}
              />
            </div>
          ) : null}
          {(isHomepage || layoutOptions.inheritHomepageChrome !== false) && (
            <>
              <div className="flex items-center justify-between">
                <Label>Hide topbar</Label>
                <Switch
                  checked={!!layoutOptions.hideTopbar}
                  onCheckedChange={(c) => setLayoutOption("hideTopbar", c)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Hide navbar</Label>
                <Switch
                  checked={!!layoutOptions.hideNavbar}
                  onCheckedChange={(c) => setLayoutOption("hideNavbar", c)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Hide footer</Label>
                <Switch
                  checked={!!layoutOptions.hideFooter}
                  onCheckedChange={(c) => setLayoutOption("hideFooter", c)}
                />
              </div>
            </>
          )}

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
            <Switch
              checked={!!seo.noindex}
              onCheckedChange={(c) => setSeoField("noindex", c)}
            />
          </div>

          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Preview &amp; score
          </p>
          <SeoPreviewPanel
            title={seo.title}
            description={seo.description}
            ogImage={seo.ogImage}
            slug={slug}
            siteName={activeSite?.name}
            baseUrl={baseUrl}
            h1Count={layoutSignals.h1Count}
            imagesMissingAlt={layoutSignals.imagesMissingAlt}
          />
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

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <Label>{label}</Label>
    {children}
  </div>
);
