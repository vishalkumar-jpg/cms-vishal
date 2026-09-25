import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { sanitizeText } from "@ob-cms/block-schema";
import { navigation, type NavigationRow } from "@database/schema";
import { AuditService } from "@common/audit/audit.service";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import { NAV_LOCATIONS, type UpsertNavigationDto } from "./dto/navigation.dto";

const MAX_DEPTH = 4;

@Injectable()
export class NavigationService {
  constructor(
    private readonly repo: ScopedRepository,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<NavigationRow[]> {
    return this.repo.db.select().from(navigation).where(this.repo.scope(navigation));
  }

  async get(location: string): Promise<NavigationRow> {
    this.assertLocation(location);
    const [row] = await this.repo.db
      .select()
      .from(navigation)
      .where(this.repo.scope(navigation, eq(navigation.location, location)))
      .limit(1);
    if (!row) throw new NotFoundException("Navigation not found for this location");
    return row;
  }

  async upsert(location: string, dto: UpsertNavigationDto, actor: AuthUser): Promise<NavigationRow> {
    this.assertLocation(location);
    const tree = this.sanitizeTree(dto.tree, 0);
    const [existing] = await this.repo.db
      .select({ id: navigation.id })
      .from(navigation)
      .where(this.repo.scope(navigation, eq(navigation.location, location)))
      .limit(1);

    let row: NavigationRow;
    if (existing) {
      [row] = await this.repo.db
        .update(navigation)
        .set({ tree: tree as unknown, updatedBy: actor.userId })
        .where(this.repo.scope(navigation, eq(navigation.id, existing.id)))
        .returning();
    } else {
      [row] = await this.repo.db
        .insert(navigation)
        .values({ ...this.repo.insertDefaults(), location, tree: tree as unknown })
        .returning();
    }
    await this.audit.record({
      siteId: this.repo.siteId,
      actorId: actor.userId,
      action: "navigation.updated",
      category: "content",
      entityType: "navigation",
      entityId: row.id,
      metadata: { location, items: tree.length },
    });
    return row;
  }

  private assertLocation(location: string): void {
    if (!(NAV_LOCATIONS as readonly string[]).includes(location)) {
      throw new BadRequestException(`Invalid location. Allowed: ${NAV_LOCATIONS.join(", ")}`);
    }
  }

  /** Recursively sanitize label/href and bound the depth. */
  private sanitizeTree(items: Array<Record<string, unknown>>, depth: number): Array<Record<string, unknown>> {
    if (depth > MAX_DEPTH) throw new BadRequestException("Navigation nesting too deep");
    if (!Array.isArray(items)) return [];
    return items.slice(0, 200).map((item) => {
      const children = Array.isArray(item.children)
        ? this.sanitizeTree(item.children as Array<Record<string, unknown>>, depth + 1)
        : [];
      return {
        label: sanitizeText(item.label ?? ""),
        href: typeof item.href === "string" ? sanitizeText(item.href) : undefined,
        pageId: typeof item.pageId === "string" ? item.pageId : undefined,
        target: item.target === "_blank" ? "_blank" : undefined,
        children,
      };
    });
  }
}
