import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import { hasRoleAtLeast, permissionsForBuiltinRole, type Role } from "@ob-cms/shared";
import { DRIZZLE } from "@database/drizzle.providers";
import type { Database } from "@database/db";
import { customRoles, siteMembers, systemUsers, type SiteMemberRow } from "@database/schema";
import { AuditService } from "@common/audit/audit.service";
import { TenantContext } from "@common/tenancy/tenant-context";
import type { AuthUser } from "@common/decorators/current-user.decorator";
import type { AddMemberDto, UpdateRoleDto } from "./dto/site-member.dto";

export interface MemberView {
  userId: string;
  email: string;
  name: string | null;
  role: Role;
  status: string;
  /** RBAC-2: assigned custom role id (null when on the built-in role's default). */
  customRoleId: string | null;
  /** RBAC-2: effective permission set (custom role's, else built-in default). */
  permissions: string[];
}

/**
 * Per-site team membership. The active site comes from the request's
 * TenantContext (set by TenantGuard), so all queries here are scoped to one
 * site — a member of site A can never read/mutate site B's members.
 */
@Injectable()
export class SiteMembersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly ctx: TenantContext,
    private readonly audit: AuditService,
  ) {}

  /** List members of the ACTIVE site only (no cross-tenant join leakage). */
  async list(): Promise<MemberView[]> {
    const siteId = this.ctx.requireSiteId();
    const rows = await this.db
      .select({
        userId: siteMembers.userId,
        role: siteMembers.role,
        status: siteMembers.status,
        email: systemUsers.email,
        name: systemUsers.name,
        customRoleId: siteMembers.customRoleId,
        customPermissions: customRoles.permissions,
        customDeletedAt: customRoles.deletedAt,
      })
      .from(siteMembers)
      .innerJoin(systemUsers, eq(systemUsers.id, siteMembers.userId))
      .leftJoin(customRoles, eq(customRoles.id, siteMembers.customRoleId))
      .where(and(eq(siteMembers.siteId, siteId), isNull(siteMembers.deletedAt)));
    return rows.map((r) => {
      // Effective perms: a LIVE custom role's set, else the built-in default.
      const hasLiveCustom = r.customRoleId && !r.customDeletedAt;
      const permissions = hasLiveCustom
        ? [...(r.customPermissions ?? [])]
        : permissionsForBuiltinRole(r.role as Role);
      return {
        userId: r.userId,
        email: r.email,
        name: r.name,
        role: r.role as Role,
        status: r.status,
        customRoleId: hasLiveCustom ? r.customRoleId : null,
        permissions,
      };
    });
  }

  async add(dto: AddMemberDto, actor: AuthUser): Promise<SiteMemberRow> {
    const siteId = this.ctx.requireSiteId();
    this.assertCeiling(dto.role as Role);

    const [user] = await this.db
      .select({ id: systemUsers.id })
      .from(systemUsers)
      .where(and(eq(systemUsers.id, dto.userId), isNull(systemUsers.deletedAt)))
      .limit(1);
    if (!user) throw new BadRequestException("User not found");

    const existing = await this.findMembership(siteId, dto.userId);
    if (existing) throw new ConflictException("User is already a member of this site");

    const [row] = await this.db
      .insert(siteMembers)
      .values({
        siteId,
        userId: dto.userId,
        role: dto.role,
        invitedBy: actor.userId,
        createdBy: actor.userId,
      })
      .returning();
    await this.audit.record({
      siteId,
      actorId: actor.userId,
      action: "team.member_added",
      category: "team",
      entityType: "site_member",
      entityId: row.id,
      metadata: { userId: dto.userId, role: dto.role },
    });
    return row;
  }

  async updateRole(userId: string, dto: UpdateRoleDto, actor: AuthUser): Promise<SiteMemberRow> {
    const siteId = this.ctx.requireSiteId();
    this.assertCeiling(dto.role as Role);
    const member = await this.findMembership(siteId, userId);
    if (!member) throw new NotFoundException("Member not found");
    if (member.role === "super_admin") {
      throw new ForbiddenException("Cannot change a platform admin's role");
    }
    // Demoting the last site_admin would orphan the site.
    if (member.role === "site_admin" && dto.role !== "site_admin") {
      await this.assertNotLastAdmin(siteId, userId);
    }
    const [row] = await this.db
      .update(siteMembers)
      .set({ role: dto.role, updatedBy: actor.userId })
      .where(eq(siteMembers.id, member.id))
      .returning();
    await this.audit.record({
      siteId,
      actorId: actor.userId,
      action: "team.role_changed",
      category: "team",
      entityType: "site_member",
      entityId: member.id,
      metadata: { userId, from: member.role, to: dto.role },
    });
    return row;
  }

  async remove(userId: string, actor: AuthUser): Promise<{ ok: true }> {
    const siteId = this.ctx.requireSiteId();
    const member = await this.findMembership(siteId, userId);
    if (!member) throw new NotFoundException("Member not found");
    if (member.role === "super_admin") {
      throw new ForbiddenException("Cannot remove a platform admin");
    }
    if (member.role === "site_admin") await this.assertNotLastAdmin(siteId, userId);

    await this.db
      .update(siteMembers)
      .set({ deletedAt: new Date(), updatedBy: actor.userId })
      .where(eq(siteMembers.id, member.id));
    await this.audit.record({
      siteId,
      actorId: actor.userId,
      action: "team.member_removed",
      category: "team",
      entityType: "site_member",
      entityId: member.id,
      metadata: { userId },
    });
    return { ok: true };
  }

  // -- guards --------------------------------------------------------------

  /** A site_admin may not grant/promote above their own level (no minting super_admin). */
  private assertCeiling(target: Role): void {
    if (!this.ctx.role) return; // platform admin (no per-site role) — allowed
    if (!hasRoleAtLeast(this.ctx.role, target)) {
      throw new ForbiddenException("Cannot assign a role above your own");
    }
  }

  private async assertNotLastAdmin(siteId: string, excludingUserId: string): Promise<void> {
    const admins = await this.db
      .select({ userId: siteMembers.userId })
      .from(siteMembers)
      .where(
        and(
          eq(siteMembers.siteId, siteId),
          eq(siteMembers.role, "site_admin"),
          eq(siteMembers.status, "active"),
          isNull(siteMembers.deletedAt),
        ),
      );
    const others = admins.filter((a) => a.userId !== excludingUserId);
    if (others.length === 0) {
      throw new ConflictException("Cannot remove or demote the last site admin");
    }
  }

  private async findMembership(siteId: string, userId: string): Promise<SiteMemberRow | undefined> {
    const [row] = await this.db
      .select()
      .from(siteMembers)
      .where(
        and(
          eq(siteMembers.siteId, siteId),
          eq(siteMembers.userId, userId),
          isNull(siteMembers.deletedAt),
        ),
      )
      .limit(1);
    return row;
  }
}
