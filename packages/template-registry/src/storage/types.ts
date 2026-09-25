/**
 * Storage abstraction for template skeleton persistence.
 *
 * Implementations may use PostgreSQL, object storage, or the filesystem.
 * The API wires a database adapter; future providers swap via DI.
 */
import type {
  CreateTemplateSkeletonInput,
  TemplateSkeletonListQuery,
  TemplateSkeletonRecord,
  UpdateTemplateSkeletonInput,
} from "../skeleton-schema";

export const TEMPLATE_SKELETON_STORAGE = Symbol("TEMPLATE_SKELETON_STORAGE");

export interface TemplateSkeletonStorage {
  /** Persist a new skeleton. Throws if `templateKey` already exists. */
  create(input: CreateTemplateSkeletonInput, actorId?: string): Promise<TemplateSkeletonRecord>;

  /** Fetch by internal id (KSUID), or null when missing/soft-deleted. */
  findById(id: string): Promise<TemplateSkeletonRecord | null>;

  /** Fetch by stable registry key (`tpl-homepage`), or null when missing. */
  findByKey(templateKey: string): Promise<TemplateSkeletonRecord | null>;

  /** Partial update of metadata and/or content. */
  update(
    id: string,
    input: UpdateTemplateSkeletonInput,
    actorId?: string,
  ): Promise<TemplateSkeletonRecord>;

  /** Soft-delete a skeleton and its content row. */
  delete(id: string, actorId?: string): Promise<void>;

  /** List skeletons matching optional catalog filters. */
  list(query: TemplateSkeletonListQuery): Promise<TemplateSkeletonRecord[]>;
}

export class TemplateSkeletonStorageError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "DUPLICATE_KEY" | "CONFLICT",
  ) {
    super(message);
    this.name = "TemplateSkeletonStorageError";
  }
}
