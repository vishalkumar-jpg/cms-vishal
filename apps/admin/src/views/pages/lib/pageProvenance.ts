import type { Page } from "../types";

/** Read-only template origin snapshot from a page row. */
export type PageProvenance = {
  sourceTemplateId: string;
  sourceTemplateKey: string;
  sourceTemplateVersion: string;
  instantiatedAt: string;
};

/** Returns provenance when all four fields are present; otherwise null. */
export const readPageProvenance = (
  page: Pick<
    Page,
    | "sourceTemplateId"
    | "sourceTemplateKey"
    | "sourceTemplateVersion"
    | "instantiatedAt"
  > | null | undefined,
): PageProvenance | null => {
  if (
    !page?.sourceTemplateId ||
    !page.sourceTemplateKey ||
    !page.sourceTemplateVersion ||
    !page.instantiatedAt
  ) {
    return null;
  }
  return {
    sourceTemplateId: page.sourceTemplateId,
    sourceTemplateKey: page.sourceTemplateKey,
    sourceTemplateVersion: page.sourceTemplateVersion,
    instantiatedAt: page.instantiatedAt,
  };
};
