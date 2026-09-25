import { Injectable } from "@nestjs/common";
import { desc, ilike, inArray, or, sql } from "drizzle-orm";
import {
  collectionItems,
  collections,
  forms,
  media,
  pages,
  posts,
} from "@database/schema";
import { ScopedRepository } from "@common/tenancy/scoped-repository";

/** A search result type discriminator — also the result group key in the UI. */
export type SearchType = "page" | "post" | "media" | "collection" | "collectionItem" | "form";

/** A unified, UI-ready search hit. `url` is an admin deep-link. */
export interface SearchHit {
  type: SearchType;
  id: string;
  title: string;
  subtitle?: string;
  url: string;
}

/** Per-type result cap — keeps the query fast and the palette readable. */
const PER_TYPE_LIMIT = 8;

/** Searchable entity types, in display order. */
const ALL_TYPES: SearchType[] = ["page", "post", "media", "collection", "collectionItem", "form"];

/**
 * SearchService — global, site-scoped content search.
 *
 * Every query goes through `ScopedRepository.scope(table, …)`, which ANDs
 * `siteId = <active>` AND `deletedAt IS NULL` into the predicate, so results
 * NEVER cross tenants. Each entity is matched with case-insensitive ILIKE on a
 * few cheap text columns, capped per type, newest-first. No heavy joins.
 */
@Injectable()
export class SearchService {
  constructor(private readonly repo: ScopedRepository) {}

  async search(q: string, types?: string): Promise<SearchHit[]> {
    const term = q?.trim();
    if (!term) return [];

    const needle = `%${term}%`;
    const wanted = this.parseTypes(types);

    const hits: SearchHit[] = [];
    // Run the per-type queries concurrently — they share the request-scoped repo.
    const tasks: Array<Promise<SearchHit[]>> = [];

    if (wanted.has("page")) tasks.push(this.searchPages(needle));
    if (wanted.has("post")) tasks.push(this.searchPosts(needle));
    if (wanted.has("media")) tasks.push(this.searchMedia(needle));
    if (wanted.has("collection")) tasks.push(this.searchCollections(needle));
    if (wanted.has("collectionItem")) tasks.push(this.searchCollectionItems(needle));
    if (wanted.has("form")) tasks.push(this.searchForms(needle));

    for (const group of await Promise.all(tasks)) hits.push(...group);
    return hits;
  }

  /** Parse the optional `types` CSV filter; default = all types. */
  private parseTypes(types?: string): Set<SearchType> {
    if (!types?.trim()) return new Set(ALL_TYPES);
    const requested = types
      .split(",")
      .map((t) => t.trim())
      .filter((t): t is SearchType => (ALL_TYPES as string[]).includes(t));
    return requested.length > 0 ? new Set(requested) : new Set(ALL_TYPES);
  }

  private async searchPages(needle: string): Promise<SearchHit[]> {
    const rows = await this.repo.db
      .select({ id: pages.id, title: pages.title, slug: pages.slug, status: pages.status })
      .from(pages)
      .where(this.repo.scope(pages, or(ilike(pages.title, needle), ilike(pages.slug, needle))))
      .orderBy(desc(pages.updatedAt))
      .limit(PER_TYPE_LIMIT);
    return rows.map((r) => ({
      type: "page" as const,
      id: r.id,
      title: r.title,
      subtitle: `/${r.slug} · ${r.status}`,
      url: `/pages/${r.id}/builder`,
    }));
  }

  private async searchPosts(needle: string): Promise<SearchHit[]> {
    const rows = await this.repo.db
      .select({ id: posts.id, title: posts.title, slug: posts.slug, status: posts.status })
      .from(posts)
      .where(this.repo.scope(posts, or(ilike(posts.title, needle), ilike(posts.slug, needle))))
      .orderBy(desc(posts.updatedAt))
      .limit(PER_TYPE_LIMIT);
    return rows.map((r) => ({
      type: "post" as const,
      id: r.id,
      title: r.title,
      subtitle: `/${r.slug} · ${r.status}`,
      url: `/blog/${r.id}/builder`,
    }));
  }

  private async searchMedia(needle: string): Promise<SearchHit[]> {
    const rows = await this.repo.db
      .select({ id: media.id, storageKey: media.storageKey, alt: media.alt, type: media.type })
      .from(media)
      .where(
        this.repo.scope(
          media,
          or(ilike(media.storageKey, needle), ilike(media.alt, needle)),
        ),
      )
      .orderBy(desc(media.createdAt))
      .limit(PER_TYPE_LIMIT);
    return rows.map((r) => ({
      type: "media" as const,
      id: r.id,
      title: r.alt?.trim() || r.storageKey.split("/").pop() || r.storageKey,
      subtitle: r.type,
      url: `/media`,
    }));
  }

  private async searchCollections(needle: string): Promise<SearchHit[]> {
    const rows = await this.repo.db
      .select({ id: collections.id, name: collections.name, slug: collections.slug })
      .from(collections)
      .where(
        this.repo.scope(
          collections,
          or(ilike(collections.name, needle), ilike(collections.slug, needle)),
        ),
      )
      .orderBy(desc(collections.updatedAt))
      .limit(PER_TYPE_LIMIT);
    return rows.map((r) => ({
      type: "collection" as const,
      id: r.id,
      title: r.name,
      subtitle: `/${r.slug}`,
      url: `/collections/${r.id}`,
    }));
  }

  private async searchCollectionItems(needle: string): Promise<SearchHit[]> {
    // Items have no title column — match on slug + the JSONB `data` blob (cast to
    // text) so free-form field values are searchable too.
    const rows = await this.repo.db
      .select({
        id: collectionItems.id,
        slug: collectionItems.slug,
        collectionId: collectionItems.collectionId,
      })
      .from(collectionItems)
      .where(
        this.repo.scope(
          collectionItems,
          or(
            ilike(collectionItems.slug, needle),
            sql`${collectionItems.data}::text ILIKE ${needle}`,
          ),
        ),
      )
      .orderBy(desc(collectionItems.updatedAt))
      .limit(PER_TYPE_LIMIT);
    if (rows.length === 0) return [];

    // Resolve parent collection names in one scoped query (no per-row joins).
    const parentIds = [...new Set(rows.map((r) => r.collectionId))];
    const parents = await this.repo.db
      .select({ id: collections.id, name: collections.name })
      .from(collections)
      .where(this.repo.scope(collections, inArray(collections.id, parentIds)));
    const nameById = new Map(parents.map((p) => [p.id, p.name]));

    return rows.map((r) => ({
      type: "collectionItem" as const,
      id: r.id,
      title: r.slug,
      subtitle: nameById.get(r.collectionId) ?? "Collection item",
      url: `/collections/${r.collectionId}`,
    }));
  }

  private async searchForms(needle: string): Promise<SearchHit[]> {
    const rows = await this.repo.db
      .select({ id: forms.id, name: forms.name, status: forms.status })
      .from(forms)
      .where(this.repo.scope(forms, ilike(forms.name, needle)))
      .orderBy(desc(forms.updatedAt))
      .limit(PER_TYPE_LIMIT);
    return rows.map((r) => ({
      type: "form" as const,
      id: r.id,
      title: r.name,
      subtitle: r.status,
      url: `/forms`,
    }));
  }
}
