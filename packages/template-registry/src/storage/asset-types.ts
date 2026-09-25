/**
 * Storage abstraction for template skeleton preview assets.
 *
 * Stores metadata references only — binaries live in future object-storage adapters.
 */
import type {
  CreateTemplateSkeletonAssetInput,
  TemplateSkeletonAssetRecord,
  UpdateTemplateSkeletonAssetInput,
} from "../asset-schema";

export const TEMPLATE_SKELETON_ASSET_STORAGE = Symbol("TEMPLATE_SKELETON_ASSET_STORAGE");

export interface TemplateSkeletonAssetStorage {
  create(
    skeletonId: string,
    input: CreateTemplateSkeletonAssetInput,
    actorId?: string,
  ): Promise<TemplateSkeletonAssetRecord>;

  findById(skeletonId: string, assetId: string): Promise<TemplateSkeletonAssetRecord | null>;

  listBySkeleton(skeletonId: string): Promise<TemplateSkeletonAssetRecord[]>;

  update(
    skeletonId: string,
    assetId: string,
    input: UpdateTemplateSkeletonAssetInput,
    actorId?: string,
  ): Promise<TemplateSkeletonAssetRecord>;

  delete(skeletonId: string, assetId: string, actorId?: string): Promise<void>;
}

export class TemplateSkeletonAssetStorageError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "DUPLICATE_ASSET" | "SKELETON_NOT_FOUND",
  ) {
    super(message);
    this.name = "TemplateSkeletonAssetStorageError";
  }
}
