/**
 * Storage abstraction for the persisted template catalog.
 *
 * Implementations project skeleton metadata (+ optional assets) into
 * {@link TemplateCatalogEntry} rows. Phase 2B wires a repository adapter;
 * this phase defines the contract only.
 */
import type { TemplateCatalogEntry, TemplateCatalogQuery } from "../catalog-schema";

export const TEMPLATE_CATALOG_STORAGE = Symbol("TEMPLATE_CATALOG_STORAGE");

export interface TemplateCatalogStorage {
  /** List catalog entries matching optional filters. */
  list(query: TemplateCatalogQuery): Promise<TemplateCatalogEntry[]>;

  /** Fetch by internal skeleton id (KSUID), or null when missing/soft-deleted. */
  getById(id: string): Promise<TemplateCatalogEntry | null>;

  /** Fetch by stable registry key (`tpl-homepage`), or null when missing. */
  getByKey(templateKey: string): Promise<TemplateCatalogEntry | null>;
}

export class TemplateCatalogStorageError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND",
  ) {
    super(message);
    this.name = "TemplateCatalogStorageError";
  }
}
