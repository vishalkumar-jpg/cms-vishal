/**
 * In-memory template registry (PR #21 / Phase 1).
 *
 * Registry layer only — no create-page copy, persistence, or HTTP APIs.
 *
 * @see docs/cms/cms-operations.md §1–§3
 */
import { toUtcIso, utcMillis, utcNowIso, utcNowMs } from "@ob-cms/shared";
import {
  type TemplateCategory,
  type TemplateMetadata,
  type TemplateQuery,
  type TemplateRegistrationInput,
  type TemplateStatus,
  type TemplateUpdateInput,
  templateMetadataSchema,
  templateQuerySchema,
  templateRegistrationInputSchema,
  templateUpdateInputSchema,
} from "./schema";

export class TemplateRegistryError extends Error {
  readonly code: "DUPLICATE_ID" | "VALIDATION" | "NOT_FOUND";

  constructor(
    code: TemplateRegistryError["code"],
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "TemplateRegistryError";
    this.code = code;
  }
}

export class TemplateRegistry {
  private readonly entries = new Map<string, TemplateMetadata>();

  /** Register a template. Rejects duplicate ids and invalid metadata. */
  register(input: TemplateRegistrationInput): TemplateMetadata {
    const parsed = templateRegistrationInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new TemplateRegistryError(
        "VALIDATION",
        `Invalid template metadata: ${parsed.error.issues
          .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("; ")}`,
        { cause: parsed.error },
      );
    }

    if (this.entries.has(parsed.data.id)) {
      throw new TemplateRegistryError(
        "DUPLICATE_ID",
        `Template id already registered: ${parsed.data.id}`,
      );
    }

    const now = utcNowIso();
    const entry = templateMetadataSchema.parse({
      ...parsed.data,
      createdAt: parsed.data.createdAt ?? now,
      updatedAt: parsed.data.updatedAt ?? now,
    });
    Object.freeze(entry.tags);
    Object.freeze(entry.supportedPageTypes);
    Object.freeze(entry);

    this.entries.set(entry.id, entry);
    return entry;
  }

  /** Update an existing template by id. Rejects invalid updates. */
  update(id: string, input: TemplateUpdateInput): TemplateMetadata {
    const parsed = templateUpdateInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new TemplateRegistryError(
        "VALIDATION",
        `Invalid template update: ${parsed.error.issues
          .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("; ")}`,
        { cause: parsed.error },
      );
    }
    return this._updateInternal(id, parsed.data);
  }

  /** Move a template to the archived status. */
  archive(id: string): TemplateMetadata {
    return this._updateInternal(id, { status: "archived" });
  }

  /** Move a template to the published status. */
  publish(id: string): TemplateMetadata {
    return this._updateInternal(id, { status: "published" });
  }

  private _updateInternal(
    id: string,
    changes: Partial<TemplateMetadata>,
  ): TemplateMetadata {
    const existing = this.requireById(id);

    const existingTime = utcMillis(existing.updatedAt);
    const nextTime = Math.max(utcNowMs(), existingTime + 1);

    const updated = templateMetadataSchema.parse({
      ...existing,
      ...changes,
      updatedAt: toUtcIso(nextTime),
    });

    Object.freeze(updated.tags);
    Object.freeze(updated.supportedPageTypes);
    Object.freeze(updated);

    this.entries.set(updated.id, updated);

    return updated;
  }

  getById(id: string): TemplateMetadata | undefined {
    return this.entries.get(id);
  }

  /** Throws NOT_FOUND when missing. */
  requireById(id: string): TemplateMetadata {
    const entry = this.getById(id);
    if (!entry) {
      throw new TemplateRegistryError(
        "NOT_FOUND",
        `Template not found: ${id}`,
      );
    }
    return entry;
  }

  list(query?: TemplateQuery): TemplateMetadata[] {
    let filter: TemplateQuery = {};
    if (query !== undefined) {
      const parsed = templateQuerySchema.safeParse(query);
      if (!parsed.success) {
        throw new TemplateRegistryError(
          "VALIDATION",
          `Invalid template query: ${parsed.error.issues
            .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
            .join("; ")}`,
          { cause: parsed.error },
        );
      }
      filter = parsed.data;
    }

    let results = [...this.entries.values()];

    if (filter.category) {
      results = results.filter((e) => e.category === filter.category);
    }
    if (filter.status) {
      results = results.filter((e) => e.status === filter.status);
    }
    if (filter.pageType) {
      const pageType = filter.pageType;
      results = results.filter((e) =>
        e.supportedPageTypes.includes(pageType),
      );
    }
    if (filter.tags && filter.tags.length > 0) {
      const needed = filter.tags;
      results = results.filter((e) =>
        needed.every((t) => e.tags.includes(t)),
      );
    }
    if (filter.featured !== undefined) {
      results = results.filter(
        (e) => (e.featured ?? false) === filter.featured,
      );
    }
    if (filter.query && filter.query.trim()) {
      const q = filter.query.trim().toLowerCase();
      results = results.filter((e) => {
        const hay = [
          e.id,
          e.displayName,
          e.description,
          ...e.tags,
          ...e.supportedPageTypes,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    return results.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  listByCategory(category: TemplateCategory): TemplateMetadata[] {
    return this.list({ category });
  }

  listByStatus(status: TemplateStatus): TemplateMetadata[] {
    return this.list({ status });
  }

  listByPageType(pageType: string): TemplateMetadata[] {
    return this.list({ pageType });
  }

  size(): number {
    return this.entries.size;
  }

  /** Test / reset helper — not part of product create-page flow. */
  clear(): void {
    this.entries.clear();
  }
}

export function createTemplateRegistry(): TemplateRegistry {
  return new TemplateRegistry();
}
