import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import {
  PERMISSION_GROUPS,
  permissionsForBuiltinRole,
  ROLES,
  type Role,
} from "@ob-cms/shared";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import { customRoles, siteMembers, type CustomRoleRow } from "@database/schema";
import { AuditService } from "@common/audit/audit.service";
import { TenantContext } from "@common/tenancy/tenant-context";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import type { CreateCustomRoleDto, UpdateCustomRoleDto } from "./dto/custom-role.dto";

export interface BuiltinRoleView {
  role: Role;
  isBuiltin: true;
  permissions: string[];
}

/**
 * RBAC-2: per-site custom roles. Site-scoped via TenantContext (set by
 * TenantGuard), so a member of site A never reads/mutates site B's roles.
 * Managed by site_admins (@Roles("site_admin") on the controller).
 */
@Injectable()
export class RolesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly ctx: TenantContext,
    private readonly audit: AuditService,
  ) {}

  /** The canonical permission catalog (domain-grouped) for the admin UI. */
  getPermissionCatalog(): typeof PERMISSION_GROUPS {
    return PERMISSION_GROUPS;
  }

  /** The 4 built-in roles + their default permission sets (read-only). */
  listBuiltinRoles(): BuiltinRoleView[] {
    return ROLES.map((role) => ({
      role,
      isBuiltin: true as const,
      permissions: permissionsForBuiltinRole(role),
    }));
  }

  /** Custom roles for the ACTIVE site only. */
  async listCustomRoles(): Promise<CustomRoleRow[]> {
    const siteId = this.ctx.requireSiteId();
    return this.db
      .select()
      .from(customRoles)
      .where(and(eq(customRoles.siteId, siteId), isNull(customRoles.deletedAt)));
  }

  async create(dto: CreateCustomRoleDto, actor: AuthUser): Promise<CustomRoleRow> {
    const siteId = this.ctx.requireSiteId();
    const existing = await this.findByName(siteId, dto.name);
    if (existing) throw new ConflictException("A role with this name already exists");

    const [row] = await this.db
      .insert(customRoles)
      .values({
        siteId,
        name: dto.name,
        description: dto.description ?? null,
        permissions: dedupe(dto.permissions),
        isBuiltin: false,
        createdBy: actor.userId,
      })
      .returning();
    await this.audit.record({
      siteId,
      actorId: actor.userId,
      action: "role.custom_created",
      category: "team",
      entityType: "custom_role",
      entityId: row.id,
      metadata: { name: row.name, permissions: row.permissions },
    });
    return row;
  }

  async update(id: string, dto: UpdateCustomRoleDto, actor: AuthUser): Promise<CustomRoleRow> {
    const siteId = this.ctx.requireSiteId();
    const role = await this.findById(siteId, id);
    if (!role) throw new NotFoundException("Custom role not found");

    if (dto.name && dto.name !== role.name) {
      const clash = await this.findByName(siteId, dto.name);
      if (clash) throw new ConflictException("A role with this name already exists");
    }

    const [row] = await this.db
      .update(customRoles)
      .set({
        name: dto.name ?? role.name,
        description: dto.description ?? role.description,
        permissions: dto.permissions ? dedupe(dto.permissions) : role.permissions,
        updatedBy: actor.userId,
      })
      .where(eq(customRoles.id, role.id))
      .returning();
    await this.audit.record({
      siteId,
      actorId: actor.userId,
      action: "role.custom_updated",
      category: "team",
      entityType: "custom_role",
      entityId: row.id,
      metadata: { name: row.name, permissions: row.permissions },
    });
    return row;
  }

  async remove(id: string, actor: AuthUser): Promise<{ ok: true }> {
    const siteId = this.ctx.requireSiteId();
    const role = await this.findById(siteId, id);
    if (!role) throw new NotFoundException("Custom role not found");

    // Detach the role from any members so we never leave a dangling pointer.
    await this.db
      .update(siteMembers)
      .set({ customRoleId: null, updatedBy: actor.userId })
      .where(and(eq(siteMembers.siteId, siteId), eq(siteMembers.customRoleId, id)));
    await this.db
      .update(customRoles)
      .set({ deletedAt: new Date(), updatedBy: actor.userId })
      .where(eq(customRoles.id, role.id));
    await this.audit.record({
      siteId,
      actorId: actor.userId,
      action: "role.custom_deleted",
      category: "team",
      entityType: "custom_role",
      entityId: role.id,
      metadata: { name: role.name },
    });
    return { ok: true };
  }

  /** Assign (or clear, when customRoleId is null) a custom role for a member. */
  async assignToMember(
    userId: string,
    customRoleId: string | null | undefined,
    actor: AuthUser,
  ): Promise<{ ok: true }> {
    const siteId = this.ctx.requireSiteId();
    const [member] = await this.db
      .select({ id: siteMembers.id })
      .from(siteMembers)
      .where(
        and(
          eq(siteMembers.siteId, siteId),
          eq(siteMembers.userId, userId),
          isNull(siteMembers.deletedAt),
        ),
      )
      .limit(1);
    if (!member) throw new NotFoundException("Member not found");

    if (customRoleId) {
      const role = await this.findById(siteId, customRoleId);
      if (!role) throw new BadRequestException("Custom role not found for this site");
    }

    await this.db
      .update(siteMembers)
      .set({ customRoleId: customRoleId ?? null, updatedBy: actor.userId })
      .where(eq(siteMembers.id, member.id));
    await this.audit.record({
      siteId,
      actorId: actor.userId,
      action: "role.custom_assigned",
      category: "team",
      entityType: "site_member",
      entityId: member.id,
      metadata: { userId, customRoleId: customRoleId ?? null },
    });
    return { ok: true };
  }

  // -- helpers ---------------------------------------------------------------

  private async findById(siteId: string, id: string): Promise<CustomRoleRow | undefined> {
    const [row] = await this.db
      .select()
      .from(customRoles)
      .where(
        and(eq(customRoles.id, id), eq(customRoles.siteId, siteId), isNull(customRoles.deletedAt)),
      )
      .limit(1);
    return row;
  }

  private async findByName(siteId: string, name: string): Promise<CustomRoleRow | undefined> {
    const [row] = await this.db
      .select()
      .from(customRoles)
      .where(
        and(
          eq(customRoles.siteId, siteId),
          eq(customRoles.name, name),
          isNull(customRoles.deletedAt),
        ),
      )
      .limit(1);
    return row;
  }
}

const dedupe = (perms: string[]): string[] => [...new Set(perms)];
