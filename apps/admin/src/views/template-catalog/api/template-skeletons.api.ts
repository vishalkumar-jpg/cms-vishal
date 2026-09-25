import { request } from "@/services/AxiosService";
import type { TemplateSkeletonRecord } from "../types-skeleton";
import type { TemplateCatalogStatus } from "../types";

/** Fetch a starter skeleton (includes layout JSON) by stable registry key. */
export const getTemplateSkeletonByKeyRequest = (
  templateKey: string,
): Promise<TemplateSkeletonRecord> =>
  request<TemplateSkeletonRecord>({
    url: `/template-skeletons/by-key/${encodeURIComponent(templateKey)}`,
    method: "GET",
  });

/** Fetch a starter skeleton by internal id. */
export const getTemplateSkeletonByIdRequest = (
  id: string,
): Promise<TemplateSkeletonRecord> =>
  request<TemplateSkeletonRecord>({
    url: `/template-skeletons/${encodeURIComponent(id)}`,
    method: "GET",
  });

export type TemplateSkeletonVersionMetadataSnapshot = {
  displayName: string;
  description: string;
  category: string;
  tags: string[];
  supportedPageTypes: string[];
  previewMetadata: TemplateSkeletonRecord["metadata"]["previewMetadata"];
  version: string;
  status: TemplateCatalogStatus;
  schemaVersion: string;
};

export type TemplateSkeletonVersionSummary = {
  skeletonId: string;
  templateKey: string;
  version: string;
  createdAt: string;
  createdBy: string | null;
  metadata: TemplateSkeletonVersionMetadataSnapshot;
};

export type TemplateSkeletonVersionDetail = TemplateSkeletonVersionSummary & {
  content: TemplateSkeletonRecord["content"];
};

/** List immutable version snapshots for a starter skeleton (newest first). */
export const listTemplateSkeletonHistoryRequest = (
  id: string,
): Promise<TemplateSkeletonVersionSummary[]> =>
  request<TemplateSkeletonVersionSummary[]>({
    url: `/template-skeletons/${encodeURIComponent(id)}/history`,
    method: "GET",
  });

/** Fetch a specific version snapshot (includes layout content for preview). */
export const getTemplateSkeletonHistoryVersionRequest = (
  id: string,
  version: string,
): Promise<TemplateSkeletonVersionDetail> =>
  request<TemplateSkeletonVersionDetail>({
    url: `/template-skeletons/${encodeURIComponent(id)}/history/${encodeURIComponent(version)}`,
    method: "GET",
  });

export type TemplateSkeletonUsagePage = {
  id: string;
  title: string;
  slug: string;
  status: string;
  sourceTemplateVersion: string;
  instantiatedAt: string;
};

export type TemplateSkeletonUsage = {
  skeletonId: string;
  templateKey: string;
  totalPages: number;
  lastUsedAt: string | null;
  currentVersion: string;
  latestVersion: string;
  pages: TemplateSkeletonUsagePage[];
  byVersion: Array<{ version: string; count: number }>;
};

export type TopTemplateUsageEntry = {
  skeletonId: string | null;
  templateKey: string;
  totalPages: number;
  lastUsedAt: string | null;
};

/** Site-scoped usage analytics for a starter skeleton. */
export const getTemplateSkeletonUsageRequest = (id: string): Promise<TemplateSkeletonUsage> =>
  request<TemplateSkeletonUsage>({
    url: `/template-skeletons/${encodeURIComponent(id)}/usage`,
    method: "GET",
  });

/** Most-used starter templates on the active site. */
export const getTopTemplateUsageRequest = (
  limit = 100,
): Promise<TopTemplateUsageEntry[]> =>
  request<TopTemplateUsageEntry[]>({
    url: `/template-skeletons/analytics/top?limit=${limit}`,
    method: "GET",
  });
