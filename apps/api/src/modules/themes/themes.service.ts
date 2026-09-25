import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { themes, type ThemeRow } from "@database/schema";
import { AuditService } from "@common/audit/audit.service";
import { ScopedRepository } from "@common/tenancy/scoped-repository";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import type { UpdateThemeDto } from "./dto/theme.dto";

/** Per-site theme tokens. 1:1 with a site; auto-created on first read. */
@Injectable()
export class ThemesService {
  constructor(
    private readonly repo: ScopedRepository,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<ThemeRow> {
    const [row] = await this.repo.db
      .select()
      .from(themes)
      .where(this.repo.scope(themes))
      .limit(1);
    if (row) return row;
    const [created] = await this.repo.db
      .insert(themes)
      .values({ ...this.repo.insertDefaults() })
      .returning();
    return created;
  }

  async update(dto: UpdateThemeDto, actor: AuthUser): Promise<ThemeRow> {
    const existing = await this.get();
    const patch: Partial<ThemeRow> = { updatedBy: actor.userId };
    if (dto.preset !== undefined) patch.preset = dto.preset;
    if (dto.tokens !== undefined) patch.tokens = dto.tokens as unknown;
    if (dto.brand !== undefined) patch.brand = dto.brand as unknown;
    const [row] = await this.repo.db
      .update(themes)
      .set(patch)
      .where(this.repo.scope(themes, eq(themes.id, existing.id)))
      .returning();
    await this.audit.record({
      siteId: this.repo.siteId,
      actorId: actor.userId,
      action: "theme.updated",
      category: "settings",
      entityType: "theme",
      entityId: row.id,
      metadata: { fields: Object.keys(dto) },
    });
    return row;
  }
}
