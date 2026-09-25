import type { CreatePageFromTemplatePayload, PageSeoMeta } from "@/views/pages/types";

export type BuildCreateFromTemplatePayloadInput = {
  title: string;
  slug: string;
  skeletonId: string;
  parentId?: string;
  seoTitle?: string;
  seoDescription?: string;
};

const cleanSeoField = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/** Build POST /pages/from-template body, omitting empty optional fields. */
export const buildCreateFromTemplatePayload = (
  input: BuildCreateFromTemplatePayloadInput,
): CreatePageFromTemplatePayload => {
  const payload: CreatePageFromTemplatePayload = {
    title: input.title,
    slug: input.slug,
    skeletonId: input.skeletonId,
  };

  if (input.parentId) {
    payload.parentId = input.parentId;
  }

  const seoTitle = cleanSeoField(input.seoTitle);
  const seoDescription = cleanSeoField(input.seoDescription);
  if (seoTitle || seoDescription) {
    const seo: PageSeoMeta = {};
    if (seoTitle) seo.title = seoTitle;
    if (seoDescription) seo.description = seoDescription;
    payload.seo = seo;
  }

  return payload;
};
